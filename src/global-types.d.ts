
// Global type fixes
declare global {
  var global: any;
}

interface ChannelResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
}

type AlertTypeType = string;
