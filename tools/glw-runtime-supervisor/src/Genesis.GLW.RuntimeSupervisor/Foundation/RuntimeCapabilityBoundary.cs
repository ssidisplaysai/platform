namespace Genesis.GLW.RuntimeSupervisor.Foundation;

public static class RuntimeCapabilityBoundary
{
    public const bool CanCreateRuntimeProcess = false;
    public const bool CanCreateProductionJob = false;
    public const bool CanResumeRuntimeThread = false;
    public const bool CanTerminateRuntime = false;
    public const bool CanControlPort3001 = false;
    public const bool CanAccessProductionJournal = false;
    public const bool CanHostProductionControlPipe = false;
    public const bool CanModifyTaskScheduler = false;
}
