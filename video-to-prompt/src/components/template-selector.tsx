"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TEMPLATE_INFO } from "@/lib/presets";

type Props = {
  value: "browser-use" | "browser-use-shadowing" | "browser-use-discovery" | "airtop";
  onChange: (v: "browser-use" | "browser-use-shadowing" | "browser-use-discovery" | "airtop") => void;
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
            <SelectItem
              value="browser-use"
              subtitle={TEMPLATE_INFO["browser-use"].description}
            >
              {TEMPLATE_INFO["browser-use"].label}
            </SelectItem>
            <SelectItem
              value="browser-use-shadowing"
              subtitle={TEMPLATE_INFO["browser-use-shadowing"].description}
            >
              {TEMPLATE_INFO["browser-use-shadowing"].label}
            </SelectItem>
            <SelectItem
              value="browser-use-discovery"
              subtitle={TEMPLATE_INFO["browser-use-discovery"].description}
            >
              {TEMPLATE_INFO["browser-use-discovery"].label}
            </SelectItem>
            <SelectItem
              value="airtop"
              subtitle={TEMPLATE_INFO["airtop"].description}
            >
              {TEMPLATE_INFO["airtop"].label}
            </SelectItem>
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
          <SelectItem
            value="browser-use"
            subtitle={TEMPLATE_INFO["browser-use"].description}
          >
            {TEMPLATE_INFO["browser-use"].label}
          </SelectItem>
          <SelectItem
            value="browser-use-shadowing"
            subtitle={TEMPLATE_INFO["browser-use-shadowing"].description}
          >
            {TEMPLATE_INFO["browser-use-shadowing"].label}
          </SelectItem>
          <SelectItem
            value="browser-use-discovery"
            subtitle={TEMPLATE_INFO["browser-use-discovery"].description}
          >
            {TEMPLATE_INFO["browser-use-discovery"].label}
          </SelectItem>
          <SelectItem
            value="airtop"
            subtitle={TEMPLATE_INFO["airtop"].description}
          >
            {TEMPLATE_INFO["airtop"].label}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}


