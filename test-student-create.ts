import { prisma } from "./lib/prisma";
import { nextStudentCode } from "./lib/student-code";
import { getStudentPaymentStatus, roundMoney } from "./lib/student-fees";
import { parseStudentEnrollmentInput } from "./lib/student-enrollment";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const session = { userId: "cmrvvp0iv0000xfl1k2u6npsw", role: "ADMIN" };
  const body = {
    firstName: "test",
    lastName: "Ayuub",
    email: "tets@gmail.com",
    phone: "615930944",
    gender: "Male",
    classId: "cmt5iv1jh0002k4u362xrsuc2",
    feeAmount: 50,
    paymentAmount: 20,
    paymentNote: "",
    enrollmentStatus: "ENROLLED",
  };

  const classId = body.classId;
  let className: string | null = null;
  if (classId) {
    const cls = await prisma.class.findUnique({ where: { id: classId }, select: { id: true, name: true } });
    if (!cls) {
      console.error("Class not found");
      return;
    }
    className = cls.name;
  }

  const paymentAmountRaw = body.paymentAmount;
  const paymentAmount = Number(paymentAmountRaw);
  const hasRegistrationPayment = Number.isFinite(paymentAmount) && paymentAmount > 0;
  const paymentNote = body.paymentNote.trim() ? body.paymentNote.trim() : null;

  const feeAmountRaw = body.feeAmount;
  const hasFeeAmount = feeAmountRaw !== undefined && feeAmountRaw !== null && feeAmountRaw !== "";
  const parsedFeeAmount = hasFeeAmount ? Number(feeAmountRaw) : (hasRegistrationPayment ? paymentAmount : 0);
  const feeAmount = roundMoney(parsedFeeAmount);
  let paymentStatus = getStudentPaymentStatus(feeAmount, hasRegistrationPayment ? paymentAmount : 0);

  const enrollment = parseStudentEnrollmentInput(body);
  if (!enrollment.ok) {
    console.error("Enrollment error:", enrollment.message);
    return;
  }

  if (enrollment.data.enrollmentStatus === "VISIT_SCHEDULED") {
    paymentStatus = "UNPAID";
  }

  const phone = body.phone ?? null;

  console.log("Input data compiled successfully. Running transaction...");

  try {
    const inserted = await prisma.$transaction(async (tx) => {
      console.log("Generating nextStudentCode for className:", className);
      const studentCode = await nextStudentCode(tx, className);
      console.log("Generated studentCode:", studentCode);

      console.log("Creating student record...");
      const student = await tx.student.create({
        data: {
          studentCode,
          firstName: body.firstName,
          lastName: body.lastName,
          phone: phone ?? null,
          email: body.email ?? null,
          gender: body.gender ?? null,
          feeAmount,
          paymentStatus,
          enrollmentStatus: enrollment.data.enrollmentStatus,
          visitDate: enrollment.data.visitDate,
          visitNote: enrollment.data.visitNote,
          visitReminderSentAt: null,
          isActive: true,
          classId,
          registeredById: session.userId,
        },
      });

      console.log("Student created. ID:", student.id);

      if (hasRegistrationPayment && enrollment.data.enrollmentStatus !== "VISIT_SCHEDULED") {
        console.log("Creating payment record...");
        await tx.payment.create({
          data: {
            studentId: student.id,
            amount: paymentAmount,
            note: paymentNote ?? "Registration payment",
            recordedById: session.userId,
          },
        });
        console.log("Payment record created.");
      }

      return student;
    });

    console.log("Transaction succeeded! Created student ID:", inserted.id);
  } catch (err) {
    console.error("Transaction failed with error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
