module.exports = [
"[project]/instrumentation.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "register",
    ()=>register
]);
async function register() {
    if ("TURBOPACK compile-time truthy", 1) {
        const { startVisitReminderCron } = await __turbopack_context__.A("[project]/lib/visit-reminder-cron.ts [instrumentation] (ecmascript, async loader)");
        startVisitReminderCron();
    }
}
}),
];

//# sourceMappingURL=instrumentation_ts_cf8be71b._.js.map