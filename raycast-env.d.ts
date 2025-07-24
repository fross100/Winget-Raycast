/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Show Info Panel - Whether to show the package information panel by default. */
  "showInfoPanel": boolean
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `main-command` command */
  export type MainCommand = ExtensionPreferences & {}
  /** Preferences accessible in the `search-packages` command */
  export type SearchPackages = ExtensionPreferences & {}
  /** Preferences accessible in the `update-packages` command */
  export type UpdatePackages = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `main-command` command */
  export type MainCommand = {}
  /** Arguments passed to the `search-packages` command */
  export type SearchPackages = {}
  /** Arguments passed to the `update-packages` command */
  export type UpdatePackages = {}
}

