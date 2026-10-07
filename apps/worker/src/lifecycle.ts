export interface WorkerLifecycleStatus {
    service: "mednova-worker";
    status: "ok";
    mode: "demo" | "configured";
    processing: false;
}

export function lifecycleStatus(demoMode: boolean): WorkerLifecycleStatus {
    return {
        service: "mednova-worker",
        status: "ok",
        mode: demoMode ? "demo" : "configured",
        processing: false,
    };
}
