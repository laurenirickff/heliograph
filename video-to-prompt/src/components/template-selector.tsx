"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  value: "browser-use" | "airtop";
  onChange: (v: "browser-use" | "airtop") => void;
  inline?: boolean;
  label?: string;
};

export function TemplateSelector({ value, onChange, inline = false, label = "Template" }: Props) {
  if (inline) {
    return (
      <div className="flex items-center gap-2">
        <Label className="text-sm text-muted-foreground">{label}</Label>
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

  return (
    <div className="w-full flex items-center gap-4">
      <Label className="w-40">Prompt template</Label>
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


