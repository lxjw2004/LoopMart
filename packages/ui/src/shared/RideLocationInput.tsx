"use client";

import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Icon } from "@astryxdesign/core/Icon";
import { InputGroup } from "@astryxdesign/core/InputGroup";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { useLocale } from "@astryxdesign/core";
import { rideLocations } from "../ride-options";

export default function RideLocationInput({ label, value, onChange, isRequired, isOptional, isDisabled, width }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  isRequired?: boolean;
  isOptional?: boolean;
  isDisabled?: boolean;
  width?: string;
}) {
  const english = useLocale().startsWith("en");
  return <VStack width={width}>
    <InputGroup label={label} isRequired={isRequired} isOptional={isOptional} isDisabled={isDisabled}>
      <TextInput label="" value={value} onChange={onChange} isDisabled={isDisabled} width="100%" />
      <DropdownMenu presentation="adaptive" hasChevron={false}
        button={{ label: (english ? "Presets: " : "常用地点：") + label, icon: <Icon icon="chevronDown" />, isIconOnly: true, variant: "ghost", isDisabled }}
        items={rideLocations.map(location => ({ id: location, label: location, onClick: () => onChange(location) }))} />
    </InputGroup>
  </VStack>;
}
