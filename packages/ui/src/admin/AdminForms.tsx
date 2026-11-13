"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Section } from "@astryxdesign/core/Section";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { errorText } from "../errors";

export interface ConfirmActionProps { title: string; summary: string; onConfirm: (reason: string) => Promise<void>; onClose: () => void; english?: boolean; busy?: boolean }

export function ConfirmAction({ title, summary, onConfirm, onClose, english = false, busy = false }: ConfirmActionProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const reasonInput = useRef<HTMLTextAreaElement>(null);
  const submitLock = useRef(false);
  const summaryId = useId();
  const pending = busy || submitting;

  useEffect(() => {
    const frame = requestAnimationFrame(() => reasonInput.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <Dialog
      isOpen
      className="admin-confirm-dialog"
      width="var(--lm-admin-dialog-width)"
      purpose={pending ? "required" : "info"}
      aria-describedby={summaryId}
      onOpenChange={open => { if (!open && !pending) onClose(); }}
      style={{ padding: "var(--lm-admin-dialog-padding)" }}
      data-testid="admin-confirmation"
    >
      <VStack as="form" gap={5} aria-busy={pending} onSubmit={async event => {
        event.preventDefault();
        if (!reason.trim() || pending || submitLock.current) return;
        submitLock.current = true;
        setSubmitting(true);
        setError(null);
        try { await onConfirm(reason.trim()); }
        catch (failure) { setError(failure); }
        finally { submitLock.current = false; setSubmitting(false); }
      }}>
        <DialogHeader title={title} hasDivider={false} />
        <Section variant="admin-summary"><Text as="p" id={summaryId} color="inherit" style={{ whiteSpace: "pre-wrap" }}>{summary}</Text></Section>
        <TextArea
          ref={reasonInput}
          label={english ? "Reason" : "操作原因"}
          value={reason}
          onChange={value => setReason(value.slice(0, 2000))}
          isRequired
          isDisabled={pending}
          maxLength={2000}
          rows={4}
        />
        {Boolean(error) && <Banner role="alert" status="error" title={errorText(error, english)} />}
        <HStack gap={3} hAlign="end" wrap="wrap" className="admin-confirm-actions">
          <Button label={english ? "Cancel" : "取消"} onClick={onClose} isDisabled={pending} />
          <Button
            type="submit"
            variant="primary"
            label={pending ? (english ? "Confirming…" : "确认中…") : (english ? "Confirm action" : "确认操作")}
            isDisabled={!reason.trim() || pending}
            isLoading={pending}
          />
        </HStack>
      </VStack>
    </Dialog>
  );
}

export default ConfirmAction;
