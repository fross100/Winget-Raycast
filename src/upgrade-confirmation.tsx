import { Action, ActionPanel, Detail, showToast, Toast, useNavigation, closeMainWindow } from "@raycast/api";
import { useState, useEffect } from "react";
import { CommandExecutor } from "./utils/windows-helpers";

interface UpgradeConfirmationProps {
  pkgId: string;
  pkgName: string;
}

export default function UpgradeConfirmation({ pkgId, pkgName }: UpgradeConfirmationProps) {
  const { pop } = useNavigation();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isUpgradeComplete, setIsUpgradeComplete] = useState(false);
  const [upgradeOutput, setUpgradeOutput] = useState("");
  const [progressValue, setProgressValue] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (isUpgrading) {
      const executor = new CommandExecutor();
      const command = pkgId === "all" 
        ? `winget upgrade --all --accept-package-agreements --accept-source-agreements`
        : `winget upgrade --id ${pkgId} -h --accept-package-agreements --accept-source-agreements`;

      executor.execute(command);

      executor.on("stdout", (data) => {
        const output = data.toString();
        setUpgradeOutput((prev) => prev + output);
        const match = output.match(/(\d{1,3})%|\((\d+)\/(\d+)\)/);
        if (match) {
          if (match[1]) {
            setProgressValue(parseInt(match[1]) / 100);
          } else if (match[2] && match[3]) {
            setProgressValue(parseInt(match[2]) / parseInt(match[3]));
          }
        }
      });

      executor.on("stderr", (data) => {
        const output = data.toString();
        setUpgradeOutput((prev) => prev + output);
        const match = output.match(/(\d{1,3})%|\((\d+)\/(\d+)\)/);
        if (match) {
          if (match[1]) {
            setProgressValue(parseInt(match[1]) / 100);
          } else if (match[2] && match[3]) {
            setProgressValue(parseInt(match[2]) / parseInt(match[3]));
          }
        }
      });

      executor.on("close", (code) => {
        setIsUpgrading(false);
        if (code === 0) {
          showToast(Toast.Style.Success, `Upgrade of ${pkgName} completed.`);
          setIsUpgradeComplete(true);
          setProgressValue(1); // Set to 100% on completion
        } else {
          showToast(Toast.Style.Failure, `Upgrade of ${pkgName} failed with code ${code}.`);
          setProgressValue(undefined); // Clear progress on failure
        }
      });

      executor.on("error", (err) => {
        setUpgradeOutput((prev) => prev + `Error: ${err.message}\n`);
        showToast(Toast.Style.Failure, `Error upgrading ${pkgName}`, String(err));
        setIsUpgrading(false);
        setProgressValue(undefined); // Clear progress on error
      });

      return () => {
        executor.kill();
      };
    }
  }, [isUpgrading, pkgId, pkgName]);

  const handleUpgrade = () => {
    setIsUpgrading(true);
    setUpgradeOutput("Starting upgrade...\n");
    setProgressValue(0); // Start progress at 0
  };

  let markdownContent: string;
  if (isUpgrading) {
    const progressText = progressValue !== undefined ? ` (${Math.round(progressValue * 100)}%)` : "";
    markdownContent = `## Upgrading...${progressText}\n\n` + "```\n" + upgradeOutput + "\n```";
  } else if (upgradeOutput) {
    markdownContent = "```\n" + upgradeOutput + "\n```";
  } else {
    markdownContent = `## Upgrade ${pkgName}?\n\nAre you sure you want to upgrade **${pkgName}**?`;
  }

  return (
    <Detail
      isLoading={isUpgrading}
      markdown={markdownContent}
      actions={
        <ActionPanel>
          {isUpgradeComplete ? (
            <Action title="Finish" onAction={pop} />
          ) : (
            <>
              {!isUpgrading && <Action title="Upgrade" onAction={handleUpgrade} />}
              <Action title="Cancel" onAction={pop} />
            </>
          )}
        </ActionPanel>
      }
    />
  );
}