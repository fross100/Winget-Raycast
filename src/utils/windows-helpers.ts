/**
 * Windows-specific utility functions for Raycast extensions
 * Based on patterns discovered from analyzing real-world Windows extensions
 */

import { exec, spawn } from "child_process";
import { promisify } from "util";
import { showToast, Toast } from "@raycast/api";
import { EventEmitter } from "events";

const execAsync = promisify(exec);

export class CommandExecutor extends EventEmitter {
  private childProcess: ReturnType<typeof spawn> | null = null;

  execute(command: string): void {
    this.childProcess = spawn(command, [], { shell: true });

    if (this.childProcess) {
      this.childProcess.stdout?.on("data", (data) => {
        this.emit("stdout", data.toString());
      });

      this.childProcess.stderr?.on("data", (data) => {
        this.emit("stderr", data.toString());
      });

      this.childProcess.on("close", (code) => {
        this.emit("close", code);
      });

      this.childProcess.on("error", (err) => {
        this.emit("error", err);
      });
    }
  }

  kill(): void {
    if (this.childProcess) {
      this.childProcess.kill();
    }
  }
}

/**
 * Execute Windows command with UTF-8 encoding support
 * Handles international characters properly
 */
export async function runShellCommand(command: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
  try {
    const { stdout, stderr } = await execAsync(command);
    return { stdout: stdout.trim(), stderr: stderr.trim(), code: 0 };
  } catch (error: any) {
    if (error.code === "ENOENT") {
      throw new Error("Command not found. Please ensure the tool is installed and in PATH.");
    } else {
      // Return stdout/stderr even on non-zero exit codes
      return { stdout: error.stdout ? error.stdout.trim() : "", stderr: error.stderr ? error.stderr.trim() : "", code: error.code };
    }
  }
}

/**
 * Parse CSV output from Windows commands
 * Handles quoted fields and filters empty entries
 */
export function parseWindowsCSV(csvOutput: string): string[][] {
  return csvOutput
    .trim()
    .split(/\r?\n/)
    .map((line) => line.replace(/"/g, "").split(","))
    .filter((parts) => parts.length > 0 && parts[0]);
}

/**
 * Format bytes to human-readable format
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

/**
 * Process multiple items with error recovery
 * Continues processing even if some items fail
 */
export async function processItemsWithRecovery<T>(
  items: T[],
  processor: (item: T) => Promise<void>,
  onProgress?: (completed: number, total: number) => void
): Promise<{
  successful: number;
  failed: number;
  errors: string[];
}> {
  const results = {
    successful: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (let i = 0; i < items.length; i++) {
    try {
      await processor(items[i]);
      results.successful++;
    } catch (error) {
      results.failed++;
      results.errors.push(error instanceof Error ? error.message : "Unknown error");
    }

    onProgress?.(i + 1, items.length);
  }

  return results;
}

/**
 * Show toast notification based on processing results
 */
export async function showProcessingResults(
  results: {
    successful: number;
    failed: number;
    errors: string[];
  },
  operation: string
): Promise<void> {
  if (results.failed === 0) {
    await showToast({
      style: Toast.Style.Success,
      title: `${operation} completed`,
      message: `Successfully processed ${results.successful} items`,
    });
  } else if (results.successful === 0) {
    await showToast({
      style: Toast.Style.Failure,
      title: `${operation} failed`,
      message: results.errors.slice(0, 3).join("; "),
    });
  } else {
    await showToast({
      style: Toast.Style.Failure,
      title: `${operation} partially completed`,
      message: `${results.successful} succeeded, ${results.failed} failed`,
    });
  }
}

/**
 * Kill Windows process by PID
 */
export async function killProcess(pid: string): Promise<void> {
  await runShellCommand(`taskkill /F /PID ${pid}`);
}

/**
 * Kill all Windows processes by name
 */
export async function killProcessByName(name: string): Promise<void> {
  await runShellCommand(`taskkill /F /IM "${name}"`);
}

/**
 * Get list of running processes
 */
export async function getProcessList(): Promise<Array<{
  name: string;
  pid: string;
  sessionName: string;
  sessionNumber: string;
  memoryUsage: string;
}>> {
  const output = await runShellCommand("tasklist /nh /fo csv");
  return parseWindowsCSV(output.stdout).map((parts) => ({
    name: parts[0] || "",
    pid: parts[1] || "",
    sessionName: parts[2] || "",
    sessionNumber: parts[3] || "",
    memoryUsage: parts[4] || "",
  }));
}

/**
 * Search files using Everything CLI (if available)
 */
export async function searchWithEverything(
  query: string,
  maxResults = 100
): Promise<string[]> {
  try {
    const command = `es.exe -n ${maxResults} ${query}`;
    const { stdout } = await runShellCommand(command);
    return stdout.split(/\r?\n/).filter((path) => path.trim());
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      throw new Error("Everything CLI not found. Please install Everything and its CLI tool.");
    }
    throw error;
  }
}

/**
 * Open file or folder in Windows Explorer
 */
export async function openInExplorer(path: string): Promise<void> {
  await runShellCommand(`explorer.exe /select,"${path}"`);
}

/**
 * Get Windows environment paths
 */
export function getWindowsPaths() {
  return {
    userProfile: process.env.USERPROFILE || "C:\\Users\\Default",
    programFiles: process.env.PROGRAMFILES || "C:\\Program Files",
    programFilesX86: process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)",
    systemRoot: process.env.SYSTEMROOT || "C:\\Windows",
    temp: process.env.TEMP || "C:\\Windows\\Temp",
    appData: process.env.APPDATA || "C:\\Users\\Default\\AppData\\Roaming",
    localAppData: process.env.LOCALAPPDATA || "C:\\Users\\Default\\AppData\\Local",
  };
}

/**
 * Check if a Windows tool is available in PATH
 */
export async function isToolAvailable(toolName: string): Promise<boolean> {
  try {
    await runShellCommand(`where ${toolName}`);
    return true;
  } catch (error) {
    return false;
  }
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null;

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      func.apply(this, args);
    }, wait);
  };
}
