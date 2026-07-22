"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { api } from "@/lib/api"
import { toast } from "@/hooks/use-toast"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Download, Mail, QrCode, Type, Upload } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"

type Student = {
    id: string;
    firstName: string;
    lastName: string;
    name: string; // derived
    classId: string;
    email: string | null
}
type ClassOption = { id: string; name: string }

function getOrdinalSuffix(day: number) {
    if (day % 100 >= 11 && day % 100 <= 13) return "th"
    switch (day % 10) {
        case 1:
            return "st"
        case 2:
            return "nd"
        case 3:
            return "rd"
        default:
            return "th"
    }
}

function formatCertificateDate(value: string) {
    if (!value) return ""
    const normalized = value.length === 10 ? `${value}T00:00:00` : value
    const date = new Date(normalized)
    if (Number.isNaN(date.getTime())) return ""
    const day = date.getDate()
    const month = date.toLocaleString("en-US", { month: "long" })
    const year = date.getFullYear()
    return `${day}${getOrdinalSuffix(day)} ${month} ${year}`
}

function buildSerialPrefix(name?: string | null) {
    if (!name) return "SR"
    const cleaned = name.replace(/[^a-zA-Z0-9 ]+/g, " ").trim()
    if (!cleaned) return "SR"
    const initials = cleaned
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part[0])
        .join("")
        .toUpperCase()
    return initials.slice(0, 2) || "SR"
}

function hashToDigits(value: string, length: number) {
    let hash = 0
    for (let i = 0; i < value.length; i += 1) {
        hash = (hash * 31 + value.charCodeAt(i)) >>> 0
    }
    const digits = String(hash % 10 ** length).padStart(length, "0")
    return digits
}

function makeSerialText(studentId: string, className?: string | null) {
    const prefix = buildSerialPrefix(className)
    const digits = hashToDigits(studentId, 6)
    return `${prefix}-${digits.slice(0, 2)}-${digits.slice(2)}`
}

function makeBarcodeBits(value: string, count: number) {
    let hash = 0
    for (let i = 0; i < value.length; i += 1) {
        hash = (hash * 31 + value.charCodeAt(i)) >>> 0
    }
    const bits: boolean[] = []
    for (let i = 0; i < count; i += 1) {
        hash = (hash * 1664525 + 1013904223) >>> 0
        bits.push(Boolean(hash & 1))
    }
    return bits
}

export default function CertificateGenerator() {
    const [classes, setClasses] = useState<ClassOption[]>([])
    const [students, setStudents] = useState<Student[]>([])
    const [loadingData, setLoadingData] = useState(true)

    const [selectedClassId, setSelectedClassId] = useState<string>("")
    const [templateUrl, setTemplateUrl] = useState<string | null>(null)
    const [templateFile, setTemplateFile] = useState<File | null>(null)
    const [contentEnabled, setContentEnabled] = useState(true)
    const [contentConfig, setContentConfig] = useState({ x: 50 })
    const [certificateDate, setCertificateDate] = useState(() => new Date().toISOString().slice(0, 10))

    // Configuration for overlays
    const [nameConfig, setNameConfig] = useState({
        x: 50,
        y: 50,
        size: 40,
        color: "#ea580c", // Default orange to match branding
        itemColor: "#000000",
        fontFamily: "serif",
        fontWeight: "bold",
        align: "center",
        autoFit: true,
        maxWidth: 70,
        showBackground: true, // Default to true to hide underlying text
        backgroundColor: "#ffffff",
        show: true
    })
    const [barcodeConfig, setBarcodeConfig] = useState({
        x: 50,
        y: 85,
        size: 100,
        show: true,
        showDate: true,
        showSerial: true
    })

    const [generating, setGenerating] = useState(false)
    const [downloading, setDownloading] = useState(false)
    const [previewStudentIndex, setPreviewStudentIndex] = useState(0)
    const [pdfLayout, setPdfLayout] = useState<"standard" | "mobile">("mobile")
    const [previewWidth, setPreviewWidth] = useState<number | null>(null)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const certificateRef = useRef<HTMLDivElement>(null)

    // Fetch initial classes only
    useEffect(() => {
        const load = async () => {
            try {
                const clsRes = await api.get<ClassOption[]>("/api/classes")
                setClasses(clsRes.data)
            } catch (e) {
                toast({ title: "Failed to load data", variant: "destructive" })
            } finally {
                setLoadingData(false)
            }
        }
        void load()
    }, [])

    useEffect(() => {
        if (!selectedClassId) {
            setStudents([])
            return
        }
        const loadStudents = async () => {
            try {
                const params = new URLSearchParams({
                    classId: selectedClassId,
                    page: "1",
                    pageSize: "100",
                    isActive: "true",
                })
                const stuRes = await api.get<{ items: any[] }>(`/api/students?${params.toString()}`)
                const mappedStudents = stuRes.data.items.map((s) => ({
                    ...s,
                    name: `${s.firstName} ${s.lastName}`.trim(),
                }))
                setStudents(mappedStudents)
            } catch {
                setStudents([])
            }
        }
        void loadStudents()
    }, [selectedClassId])

    // Filter students by selected class (already loaded per class from API)
    const classStudents = students
    const selectedClass = classes.find(c => c.id === selectedClassId) ?? null

    // Preview Logic - Hoisted so it can be used in handleDownloadPDF
    const previewStudent = classStudents[previewStudentIndex] || { name: "John Doe", id: "STU-EXAMPLE" }
    const certificateDateText = formatCertificateDate(certificateDate)
    const serialText = makeSerialText(previewStudent.id, selectedClass?.name)
    const barcodeBits = makeBarcodeBits(serialText, 40)
    const nameMaxWidthPx = previewWidth ? (previewWidth * nameConfig.maxWidth) / 100 : null
    const previewNameSize = useMemo(() => {
        if (!nameConfig.autoFit || !nameMaxWidthPx) return nameConfig.size
        if (typeof document === "undefined") return nameConfig.size
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")
        if (!ctx) return nameConfig.size
        const weight = nameConfig.fontWeight === "bold" ? "700" : "400"
        ctx.font = `${weight} ${nameConfig.size}px ${nameConfig.fontFamily}`
        const textWidth = ctx.measureText(previewStudent.name || "Student").width
        if (textWidth <= nameMaxWidthPx) return nameConfig.size
        const scaled = Math.max(10, Math.floor(nameConfig.size * (nameMaxWidthPx / textWidth)))
        return scaled
    }, [
        nameConfig.autoFit,
        nameConfig.maxWidth,
        nameConfig.size,
        nameConfig.fontFamily,
        nameConfig.fontWeight,
        nameMaxWidthPx,
        previewStudent.name
    ])
    const bodyFontSize = Math.max(12, Math.round(previewNameSize * 0.4))
    const bodyLineGap = Math.round(bodyFontSize * 0.45)
    const contentOffset = Math.round(previewNameSize * 0.9)
    const bodyOffset = Math.round(previewNameSize * 1.2)
    const classNameLabel = selectedClass?.name ?? "Course"

    // Reset preview index when class changes
    useEffect(() => {
        setPreviewStudentIndex(0)
    }, [selectedClassId])

    useEffect(() => {
        return () => {
            if (templateUrl) URL.revokeObjectURL(templateUrl)
        }
    }, [templateUrl])

    useEffect(() => {
        const node = certificateRef.current
        if (!node) return
        const update = () => setPreviewWidth(node.getBoundingClientRect().width)
        update()
        let observer: ResizeObserver | null = null
        if (typeof ResizeObserver !== "undefined") {
            observer = new ResizeObserver(update)
            observer.observe(node)
        }
        window.addEventListener("resize", update)
        return () => {
            window.removeEventListener("resize", update)
            observer?.disconnect()
        }
    }, [templateUrl])

    const readFileAsDataUrl = (file: File) =>
        new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result))
            reader.onerror = () => reject(new Error("Failed to read template file"))
            reader.readAsDataURL(file)
        })

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            if (templateUrl) URL.revokeObjectURL(templateUrl)
            const url = URL.createObjectURL(file)
            setTemplateUrl(url)
            setTemplateFile(file)
        }
    }

    const handleDownloadPDF = async () => {
        if (!certificateRef.current) return
        setDownloading(true)

        try {
            const canvas = await html2canvas(certificateRef.current, {
                useCORS: true,
                scale: 2 // Higher resolution
            })

            const imgData = canvas.toDataURL('image/png')
            const isMobilePdf = pdfLayout === "mobile"
            const pageWidth = isMobilePdf ? canvas.height : canvas.width
            const pageHeight = isMobilePdf ? canvas.width : canvas.height
            const pdf = new jsPDF({
                orientation: isMobilePdf ? 'p' : canvas.width > canvas.height ? 'l' : 'p',
                unit: 'px',
                format: [pageWidth, pageHeight]
            })

            const scale = isMobilePdf ? pageWidth / canvas.width : 1
            const imgWidth = canvas.width * scale
            const imgHeight = canvas.height * scale
            const imgX = (pageWidth - imgWidth) / 2
            const imgY = (pageHeight - imgHeight) / 2
            pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth, imgHeight)
            pdf.save(`${previewStudent.name.replace(/\s+/g, '_')}_Certificate.pdf`)

            toast({ title: "Certificate Downloaded", description: `Saved for ${previewStudent.name}` })
        } catch (error) {
            console.error(error)
            toast({ title: "Failed to download", variant: "destructive" })
        } finally {
            setDownloading(false)
        }
    }

    const handleGenerateAndSend = async () => {
        if (!selectedClassId) return toast({ title: "Select a class first", variant: "destructive" })
        if (!classStudents.length) return toast({ title: "No students in this class", variant: "destructive" })
        if (!templateFile) return toast({ title: "Upload a certificate template", variant: "destructive" })

        setGenerating(true)

        try {
            const templateDataUrl = await readFileAsDataUrl(templateFile)
            const response = await api.post("/api/certificates/send", {
                classId: selectedClassId,
                template: {
                    name: templateFile.name,
                    type: templateFile.type,
                    dataUrl: templateDataUrl
                },
                settings: {
                    name: nameConfig,
                    barcode: barcodeConfig,
                    content: contentConfig,
                    contentEnabled,
                    dateText: certificateDateText,
                    pdfLayout
                },
                studentIds: classStudents.map(s => s.id)
            })

            const result = response.data as { sent?: number; skipped?: number; failed?: number; total?: number }
            const sent = result?.sent ?? 0
            const skipped = result?.skipped ?? 0
            const failed = result?.failed ?? 0
            const total = result?.total ?? classStudents.length

            toast({
                title: "Certificate emails processed",
                description: `Total ${total}. Sent ${sent}, skipped ${skipped}, failed ${failed}.`,
                className: failed ? undefined : "bg-green-600 text-white border-none"
            })
        } catch (e) {
            toast({ title: "Failed to process certificates", variant: "destructive" })
        } finally {
            setGenerating(false)
        }
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Certificate Center</h1>
                    <p className="text-muted-foreground mt-1">Design, generate, and email certificates automatically.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => document.getElementById('template-upload')?.click()}>
                        <Upload className="mr-2 h-4 w-4" /> Upload Template
                    </Button>
                    <input
                        id="template-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Controls Sidebar */}
                <Card className="lg:col-span-4 p-6 space-y-8 h-fit">
                    <div className="space-y-4">
                        <Label className="text-xs uppercase font-bold text-muted-foreground">Target Audience</Label>
                        <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Class" />
                            </SelectTrigger>
                            <SelectContent>
                                {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        {selectedClassId && (
                            <div className="bg-muted/50 p-3 rounded-md flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Recipients:</span>
                                <Badge variant="secondary">{classStudents.length} Students</Badge>
                            </div>
                        )}
                    </div>

                    <div className="space-y-6">
                        <Label className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-2">
                            <Type className="w-4 h-4" /> Name Styling
                        </Label>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase text-muted-foreground">Text Color</Label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={nameConfig.color}
                                            onChange={(e) => setNameConfig(p => ({ ...p, color: e.target.value }))}
                                            className="h-8 w-12 rounded border cursor-pointer"
                                        />
                                        <span className="text-xs font-mono">{nameConfig.color}</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase text-muted-foreground">Font Style</Label>
                                    <Select
                                        value={nameConfig.fontFamily}
                                        onValueChange={(v) => setNameConfig(p => ({ ...p, fontFamily: v }))}
                                    >
                                        <SelectTrigger className="h-8">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="serif">Serif (Formal)</SelectItem>
                                            <SelectItem value="sans-serif">Sans (Modern)</SelectItem>
                                            <SelectItem value="cursive">Cursive (Handwritten)</SelectItem>
                                            <SelectItem value="fantasy">Fantasy (Decorative)</SelectItem>
                                            <SelectItem value="monospace">Mono (Technical)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase text-muted-foreground">Name Align</Label>
                                <Select
                                    value={nameConfig.align}
                                    onValueChange={(v) => setNameConfig(p => ({ ...p, align: v }))}
                                >
                                    <SelectTrigger className="h-8">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="left">Left</SelectItem>
                                        <SelectItem value="center">Center</SelectItem>
                                        <SelectItem value="right">Right</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center justify-between border p-2 rounded-md bg-muted/20">
                                <Label className="text-xs font-medium">Auto Fit Name</Label>
                                <Switch
                                    checked={nameConfig.autoFit}
                                    onCheckedChange={(c) => setNameConfig(p => ({ ...p, autoFit: c }))}
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span>Max Name Width ({nameConfig.maxWidth}%)</span>
                                </div>
                                <Slider
                                    value={[nameConfig.maxWidth]}
                                    min={30}
                                    max={100}
                                    step={1}
                                    onValueChange={([v]) => setNameConfig(prev => ({ ...prev, maxWidth: v }))}
                                />
                            </div>

                            <div className="flex items-center justify-between border p-2 rounded-md bg-muted/20">
                                <Label className="text-xs font-medium">Mask Background?</Label>
                                <Switch
                                    checked={nameConfig.showBackground}
                                    onCheckedChange={(c) => setNameConfig(p => ({ ...p, showBackground: c }))}
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span>Position X-Axis ({nameConfig.x}%)</span>
                                </div>
                                <Slider
                                    value={[nameConfig.x]}
                                    max={100}
                                    step={1}
                                    onValueChange={([v]) => setNameConfig(prev => ({ ...prev, x: v }))}
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span>Position Y-Axis ({nameConfig.y}%)</span>
                                </div>
                                <Slider
                                    value={[nameConfig.y]}
                                    max={100}
                                    step={1}
                                    onValueChange={([v]) => setNameConfig(prev => ({ ...prev, y: v }))}
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span>Font Size ({nameConfig.size}px)</span>
                                </div>
                                <Slider
                                    value={[nameConfig.size]}
                                    max={100}
                                    step={1}
                                    onValueChange={([v]) => setNameConfig(prev => ({ ...prev, size: v }))}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <Label className="text-xs uppercase font-bold text-muted-foreground">Certificate Text</Label>
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-normal">Show Certificate Text</Label>
                            <Switch checked={contentEnabled} onCheckedChange={setContentEnabled} />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                                <span>Position X-Axis ({contentConfig.x}%)</span>
                            </div>
                            <Slider
                                value={[contentConfig.x]}
                                max={100}
                                step={1}
                                onValueChange={([v]) => setContentConfig(prev => ({ ...prev, x: v }))}
                            />
                        </div>
                    </div>

                    <div className="space-y-6">
                        <Label className="text-xs uppercase font-bold text-muted-foreground">PDF Output</Label>
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-normal">Mobile-friendly PDF</Label>
                            <Switch
                                checked={pdfLayout === "mobile"}
                                onCheckedChange={(c) => setPdfLayout(c ? "mobile" : "standard")}
                            />
                        </div>
                    </div>

                    <div className="space-y-6">
                        <Label className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-2">
                            <QrCode className="w-4 h-4" /> Barcode / ID Settings
                        </Label>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-normal">Show Barcode</Label>
                                <Switch checked={barcodeConfig.show} onCheckedChange={(c) => setBarcodeConfig(p => ({ ...p, show: c }))} />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-normal">Show Date</Label>
                                <Switch checked={barcodeConfig.showDate} onCheckedChange={(c) => setBarcodeConfig(p => ({ ...p, showDate: c }))} />
                            </div>
                            {barcodeConfig.showDate && (
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase text-muted-foreground">Certificate Date</Label>
                                    <Input
                                        type="date"
                                        value={certificateDate}
                                        onChange={(e) => setCertificateDate(e.target.value)}
                                        className="h-8"
                                    />
                                </div>
                            )}
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-normal">Show Serial</Label>
                                <Switch checked={barcodeConfig.showSerial} onCheckedChange={(c) => setBarcodeConfig(p => ({ ...p, showSerial: c }))} />
                            </div>
                            {barcodeConfig.show && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span>Position X-Axis ({barcodeConfig.x}%)</span>
                                    </div>
                                    <Slider
                                        value={[barcodeConfig.x]}
                                        max={100}
                                        step={1}
                                        onValueChange={([v]) => setBarcodeConfig(prev => ({ ...prev, x: v }))}
                                    />
                                </div>
                            )}
                            {barcodeConfig.show && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span>Position Y-Axis ({barcodeConfig.y}%)</span>
                                    </div>
                                    <Slider
                                        value={[barcodeConfig.y]}
                                        max={100}
                                        step={1}
                                        onValueChange={([v]) => setBarcodeConfig(prev => ({ ...prev, y: v }))}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t">
                        <Button
                            variant="secondary"
                            className="w-full"
                            onClick={handleDownloadPDF}
                            disabled={downloading || !templateUrl}
                        >
                            {downloading ? <Spinner className="mr-2 h-4 w-4" /> : <Download className="mr-2 h-4 w-4" />}
                            Download Preview PDF
                        </Button>

                        <Button
                            onClick={handleGenerateAndSend}
                            disabled={generating || !selectedClassId || !templateUrl}
                            className="w-full h-12 text-base shadow-lg hover:shadow-primary/20"
                        >
                            {generating ? (
                                <>
                                    <Spinner className="mr-2 h-4 w-4" /> Processing...
                                </>
                            ) : (
                                <>
                                    <Mail className="mr-2 h-4 w-4" /> Generate & Email All
                                </>
                            )}
                        </Button>
                        <p className="text-[10px] text-muted-foreground text-center px-4">
                            * Email delivery requires a live SMTP server. Use 'Download' to test generation.
                        </p>
                    </div>
                </Card>

                {/* Live Preview Area */}
                <div className="lg:col-span-8 space-y-4">
                    <div className="flex justify-between items-center">
                        <Label className="text-xs uppercase font-bold text-muted-foreground">Live Preview</Label>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant="ghost"
                                disabled={previewStudentIndex === 0}
                                onClick={() => setPreviewStudentIndex(i => i - 1)}
                            >
                                Previous
                            </Button>
                            <span className="text-sm flex items-center text-muted-foreground">
                                {classStudents.length > 0 ? `${previewStudentIndex + 1} / ${classStudents.length}` : "0 / 0"}
                            </span>
                            <Button
                                size="sm"
                                variant="ghost"
                                disabled={previewStudentIndex >= classStudents.length - 1}
                                onClick={() => setPreviewStudentIndex(i => i + 1)}
                            >
                                Next
                            </Button>
                        </div>
                    </div>

                    <Card className="min-h-[500px] flex items-center justify-center bg-muted/20 border-dashed overflow-hidden relative" id="certificate-preview">
                        {!templateUrl ? (
                            <div className="text-center p-10 space-y-4">
                                <div className="p-4 bg-muted rounded-full w-20 h-20 mx-auto flex items-center justify-center">
                                    <Upload className="w-10 h-10 text-muted-foreground" />
                                </div>
                                <h3 className="font-semibold text-lg">No Template Uploaded</h3>
                                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                                    Upload a blank certificate image (JPG/PNG) to start designing.
                                    The system will automatically overlay student names.
                                </p>
                            </div>
                        ) : (
                            <div className="relative shadow-2xl max-w-full" ref={certificateRef}>
                                <img src={templateUrl} alt="Certificate Template" className="max-w-full h-auto max-h-[700px] object-contain" />

                                {contentEnabled && (
                                    <>
                                        <div
                                            className="absolute flex justify-center pointer-events-none"
                                            style={{ top: `calc(${nameConfig.y}% - ${contentOffset}px)`, left: `${contentConfig.x}%`, transform: "translateX(-50%)" }}
                                        >
                                            <div
                                                style={{
                                                    color: "#1f2937",
                                                    fontSize: `${bodyFontSize}px`,
                                                    fontFamily: "sans-serif"
                                                }}
                                            >
                                                this is to Certify
                                            </div>
                                        </div>
                                        <div
                                            className="absolute flex justify-center pointer-events-none"
                                            style={{ top: `calc(${nameConfig.y}% + ${bodyOffset}px)`, left: `${contentConfig.x}%`, transform: "translateX(-50%)" }}
                                        >
                                            <div
                                                className="text-center max-w-[70%]"
                                                style={{
                                                    color: "#1f2937",
                                                    fontSize: `${bodyFontSize}px`,
                                                    fontFamily: "sans-serif",
                                                    lineHeight: `${bodyFontSize + bodyLineGap}px`
                                                }}
                                            >
                                                Has successfully completed the requirements for the {classNameLabel} course, with all the honors and rights pertaining.
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Name Overlay */}
                            {nameConfig.show && (
                                <div
                                    className="absolute pointer-events-none"
                                    style={{
                                            top: `${nameConfig.y}%`,
                                            left: `${nameConfig.x}%`,
                                            transform:
                                                nameConfig.align === "left"
                                                    ? "translateX(0)"
                                                    : nameConfig.align === "right"
                                                        ? "translateX(-100%)"
                                                        : "translateX(-50%)"
                                        }}
                                    >
                                        <div
                                            style={{
                                                color: nameConfig.color,
                                                fontSize: `${previewNameSize}px`,
                                                fontWeight: nameConfig.fontWeight,
                                                fontFamily: nameConfig.fontFamily,
                                                backgroundColor: nameConfig.showBackground ? nameConfig.backgroundColor : 'transparent',
                                                padding: nameConfig.showBackground ? '4px 16px' : '0',
                                                borderRadius: '4px',
                                                minWidth: '300px', // Ensure it covers the underlying text
                                                textAlign: nameConfig.align,
                                                maxWidth: `${nameConfig.maxWidth}%`,
                                                whiteSpace: "nowrap"
                                            }}
                                        >
                                            {previewStudent.name}
                                        </div>
                                    </div>
                                )}

                                {/* Barcode Overlay (Simulated) */}
                                {barcodeConfig.show && (
                                    <div
                                        className="absolute pointer-events-none"
                                        style={{ top: `${barcodeConfig.y}%`, left: `${barcodeConfig.x}%`, transform: "translateX(-50%)" }}
                                    >
                                        <div className="bg-white p-1">
                                            {barcodeConfig.showDate && certificateDateText && (
                                                <div className="text-[10px] text-center mb-1" style={{ color: nameConfig.color }}>
                                                    {certificateDateText}
                                                </div>
                                            )}
                                            {/* Mock Barcode Visual */}
                                            <div className="flex gap-[2px] h-8 items-end opacity-80">
                                                {barcodeBits.map((bit, i) => (
                                                    <div key={i} className="bg-black w-[2px]" style={{ height: `${bit ? 100 : 60}%` }} />
                                                ))}
                                            </div>
                                            {barcodeConfig.showSerial && (
                                                <div className="text-[8px] text-center font-mono mt-0.5">SERIAL # : {serialText}</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>
                    <p className="text-xs text-muted-foreground text-center">
                        * This is a preview. The final PDF will use high-resolution rendering.
                    </p>
                </div>
            </div>
        </div>
    )
}
