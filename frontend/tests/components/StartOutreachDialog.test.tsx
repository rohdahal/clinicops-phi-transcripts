import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StartOutreachDialog from "../../src/components/dashboard/StartOutreachDialog";

describe("StartOutreachDialog", () => {
  it("renders patient details and handles channel switching", () => {
    const onChannelChange = vi.fn();
    const onConfirm = vi.fn();

    render(
      <StartOutreachDialog
        open
        loading={false}
        error={null}
        patientPseudonym="PT-100"
        emailMasked="p***@mail.com"
        phoneMasked="***-***-1234"
        outreachChannel="text"
        isSubmitting={false}
        onChannelChange={onChannelChange}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText("PT-100")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "email" }));
    expect(onChannelChange).toHaveBeenCalledWith("email");

    fireEvent.click(screen.getByRole("button", { name: "Start with AI (text)" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("shows loading and error states", () => {
    render(
      <StartOutreachDialog
        open
        loading
        error="Patient lookup failed"
        outreachChannel="call"
        isSubmitting={false}
        onChannelChange={vi.fn()}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText("Loading patient details...")).toBeInTheDocument();
    expect(screen.getByText("Patient lookup failed")).toBeInTheDocument();
  });
});
