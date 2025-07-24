import { Action, ActionPanel, Detail, showToast, Toast, useNavigation, closeMainWindow } from "@raycast/api";
import { useState, useEffect } from "react";
import { CommandExecutor } from "./utils/windows-helpers";

interface InstallConfirmationProps {
  pkgId: string;
  pkgName: string;
}

export default function InstallConfirmation({ pkgId, pkgName }: InstallConfirmationProps) {
  const { pop } = useNavigation();
  const [isInstalling, setIsInstalling] = useState(false);
  const [isInstallationComplete, setIsInstallationComplete] = useState(false);
  const [installOutput, setInstallOutput] = useState("");
  const [progressValue, setProgressValue] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (isInstalling) {
      const executor = new CommandExecutor();
      executor.execute(`winget install --id ${pkgId} -h --accept-package-agreements --accept-source-agreements`);

      executor.on("stdout", (data) => {
        const output = data.toString();
        setInstallOutput((prev) => prev + output);
        const match = output.match(/(\d+)%/);
        if (match && match[1]) {
          setProgressValue(parseInt(match[1]) / 100);
        }
      });

      executor.on("stderr", (data) => {
        const output = data.toString();
        setInstallOutput((prev) => prev + output);
        const match = output.match(/(\d+)%/);
        if (match && match[1]) {
          setProgressValue(parseInt(match[1]) / 100);
        }
      });

      executor.on("close", (code) => {
        setIsInstalling(false);
        if (code === 0) {
          showToast(Toast.Style.Success, `Installation of ${pkgName} completed.`);
          setIsInstallationComplete(true);
          setProgressValue(1); // Set to 100% on completion
        } else {
          showToast(Toast.Style.Failure, `Installation of ${pkgName} failed with code ${code}.`);
          setProgressValue(undefined); // Clear progress on failure
        }
      });

      executor.on("error", (err) => {
        setInstallOutput((prev) => prev + `Error: ${err.message}\n`);
        showToast(Toast.Style.Failure, `Error installing ${pkgName}`, String(err));
        setIsInstalling(false);
        setProgressValue(undefined); // Clear progress on error
      });

      return () => {
        executor.kill();
      };
    }
  }, [isInstalling, pkgId, pkgName]);

  const handleInstall = () => {
    setIsInstalling(true);
    setInstallOutput("Starting installation...\n");
    setProgressValue(0); // Start progress at 0
  };

  let markdownContent: string;
  if (isInstalling) {
    const progressText = progressValue !== undefined ? ` (${Math.round(progressValue * 100)}%)` : "";
    markdownContent = `## Installing...${progressText}\n\n` + "```\n" + installOutput + "\n```";
  } else if (installOutput) {
    markdownContent = "```\n" + installOutput + "\n```";
  } else {
    markdownContent = `## Install Package?\n\nAre you sure you want to install **${pkgName}**?`;
  }

  return (
    <Detail
      isLoading={isInstalling}
      markdown={markdownContent}
      actions={
        <ActionPanel>
          {isInstallationComplete ? (
            <Action title="Finish" onAction={pop} />
          ) : (
            <>
              {!isInstalling && <Action title="Install" onAction={handleInstall} />}
              <Action title="Cancel" onAction={pop} />
            </>
          )}
        </ActionPanel>
      }
    />
  );
}