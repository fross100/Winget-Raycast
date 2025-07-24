import { Action, ActionPanel, Icon, List, showToast, Toast, getPreferenceValues, ActionPanelItem } from "@raycast/api"
import SearchPackages from "./search-packages"
import UpdatePackages from "./update-packages"

export default function Command() {
    return (
        <List>
            <List.Item
                title="Search Packages"
                subtitle="Search for packages using Winget"
                icon={Icon.MagnifyingGlass}
                actions={
                    <ActionPanel>
                        <Action.Push
                            title="Search Packages"
                            icon={Icon.MagnifyingGlass}
                            target={<SearchPackages />}
                        />
                    </ActionPanel>
                }
            />
            <List.Item
                title="Update Packages"
                subtitle="List and update outdated packages using Winget"
                icon={Icon.Download}
                actions={
                    <ActionPanel>
                        <Action.Push
                            title="Update Packages"
                            icon={Icon.Download}
                            target={<UpdatePackages />}
                        />
                    </ActionPanel>
                }
            />
        </List>
    )
}
