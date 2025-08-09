"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  value: "browser-use" | "airtop";
  onChange: (v: "browser-use" | "airtop") => void;
};

export function TemplateSelector({ value, onChange }: Props) {
  return (
    <div className="w-full flex items-center gap-4">
      <Label className="w-40">Prompt preset</Label>
      <Select value={value} onValueChange={(v) => onChange(v as Props["value"]) }>
        <SelectTrigger className="w-[240px]">
          <SelectValue placeholder="Select a template" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="browser-use">Browser-Use MCP</SelectItem>
          <SelectItem value="airtop">AirTop</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}


