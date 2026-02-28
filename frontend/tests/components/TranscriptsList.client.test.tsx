import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { MouseEvent, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TranscriptsList from "../../app/transcripts/TranscriptsList.client";

const { pushMock, fetchTranscriptsPageMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  fetchTranscriptsPageMock: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock })
}));

vi.mock("next/link", () => ({
  default: ({ href, children, onClick }: { href: string; children: ReactNode; onClick?: (event: MouseEvent) => void }) => (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  )
}));

vi.mock("../../src/lib/backend", async () => {
  const actual = await vi.importActual<typeof import("../../src/lib/backend")>("../../src/lib/backend");
  return {
    ...actual,
    fetchTranscriptsPage: fetchTranscriptsPageMock
  };
});

describe("TranscriptsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters loaded rows by search text and source", () => {
    render(
      <TranscriptsList
        initialItems={[
          {
            id: "t1",
            created_at: "2026-02-20T00:00:00.000Z",
            patient_pseudonym: "Alpha",
            source: "call",
            source_ref: "ref-1"
          },
          {
            id: "t2",
            created_at: "2026-02-21T00:00:00.000Z",
            patient_pseudonym: "Beta",
            source: "chat",
            source_ref: null
          }
        ]}
        initialNextOffset={null}
        initialHasMore={false}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Filter loaded results..."), {
      target: { value: "alp" }
    });
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "chat" } });
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
  });

  it("loads next page and appends rows", async () => {
    fetchTranscriptsPageMock.mockResolvedValue({
      items: [
        {
          id: "t2",
          created_at: "2026-02-21T00:00:00.000Z",
          patient_pseudonym: "Beta",
          source: "chat",
          source_ref: null
        }
      ],
      limit: 20,
      offset: 1,
      next_offset: null,
      has_more: false
    });

    render(
      <TranscriptsList
        initialItems={[
          {
            id: "t1",
            created_at: "2026-02-20T00:00:00.000Z",
            patient_pseudonym: "Alpha",
            source: "call",
            source_ref: "ref-1"
          }
        ]}
        initialNextOffset={1}
        initialHasMore
        accessToken="token-1"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));

    await waitFor(() => {
      expect(fetchTranscriptsPageMock).toHaveBeenCalledWith(
        expect.objectContaining({ offset: 1, accessToken: "token-1" })
      );
    });

    expect(await screen.findByText("Beta")).toBeInTheDocument();
  });

  it("navigates when row clicked", () => {
    render(
      <TranscriptsList
        initialItems={[
          {
            id: "t1",
            created_at: "2026-02-20T00:00:00.000Z",
            patient_pseudonym: "Alpha",
            source: "call",
            source_ref: "ref-1"
          }
        ]}
        initialNextOffset={null}
        initialHasMore={false}
      />
    );

    fireEvent.click(screen.getByText("Alpha"));
    expect(pushMock).toHaveBeenCalledWith("/transcripts/t1?from=inbox");
  });
});
