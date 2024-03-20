interface ExecutionResult {
	stdout: string;
	stderr: string;
	output: string;
	code: number | null;
	signal: string | null;
}

type CompilationResult = ExecutionResult;

interface ExecutionResponse {
	language: string;
	version: string;
	run: ExecutionResult;
	compile?: CompilationResult;
}

interface TestResultsSummary {
	taskId: number;
	passedTests: number;
	totalTests: number;
	executionDate: Date;
}
