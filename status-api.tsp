import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";

using Http;
using Rest;

@service(#{
  title: "Son of Anton Status API",
})
namespace AntonStatus;

enum IssueStatus {
  Planning: "Planning",
  Specifying: "Specifying",
  WaitingPlanReview: "Waiting Plan review",
  Implementing: "Implementing",
  WaitingPRReview: "Waiting PR review",
  YOLO: "YOLO",
  Done: "Done",
  Closed: "Closed",
  ConflictDetected: "Conflict detected",
}

model Issue {
  @doc("Issue number")
  @path
  number: int32;

  @doc("Issue title")
  title: string;

  @doc("Issue URL")
  url: string;

  @doc("Current status of the issue in Son of Anton workflow")
  status: IssueStatus;

  @doc("URL to the comment containing the latest proposed plan")
  lastPlanCommentUrl?: string;

  @doc("URL to the Pull Request created for this issue")
  prUrl?: string;

  @doc("Name of the git branch on GitHub")
  branchName?: string;

  @doc("URL to the git branch on GitHub")
  branchUrl?: string;

  @doc("URL to the workflow in Restate")
  workflowUrl?: string;

}

model Session {
  @doc("Session ID (usually a timestamp)")
  @path
  id: string;

  @doc("Type of the session")
  type: "planning" | "implementing" | "addressing-review";

  @doc("Timestamp when the session started")
  timestamp: utcDateTime;

  @doc("Final status of the session")
  status: "success" | "failure";
}

enum PlanningSessionStatus {
  waiting_approval: "waiting_approval",
  approved: "approved",
  needs_revision: "needs_revision",
}

model PlanningStep {
  @doc("The plan proposed by Anton")
  plan: string;

  @doc("User feedback if any")
  feedback?: string;

  @doc("Timestamp of the proposal")
  timestamp: utcDateTime;
}

model PlanningSession {
  @doc("Issue number")
  number: int32;

  @doc("Current status of the planning session")
  status: PlanningSessionStatus;

  @doc("History of proposed plans and feedback")
  history: PlanningStep[];
}

model Paged<T> {
  @doc("Items in the current page")
  items: T[];

  @doc("Cursor for the next page of results")
  nextCursor?: string;
}

@route("/api/issues")
interface Issues {
  @doc("List all issues worked by Son of Anton")
  @get list(@query cursor?: string, @query limit?: int32): Paged<Issue>;

  @doc("Get details of a specific issue")
  @get get(@path number: int32): Issue | { @statusCode _: 404 };

  @doc("Delete all data for an issue and terminate its workflow")
  @delete delete(@path number: int32): void | { @statusCode _: 404 };

  @doc("List all sessions associated with an issue")
  @route("/{number}/sessions")
  @get listSessions(@path number: int32, @query cursor?: string, @query limit?: int32): Paged<Session> | { @statusCode _: 404 };

  @doc("Get the full log content of a specific session")
  @route("/{number}/sessions/{id}")
  @get getSessionContent(@path number: int32, @path id: string): string | { @statusCode _: 404 };

  @doc("Get the current planning session for an issue")
  @route("/{number}/planning")
  @get getPlanningSession(@path number: int32): PlanningSession | { @statusCode _: 404 };

  @doc("Approve the current plan for an issue")
  @route("/{number}/planning/approve")
  @post approvePlan(@path number: int32): void | { @statusCode _: 404 };

  @doc("Provide feedback on the current plan for an issue")
  @route("/{number}/planning/feedback")
  @post provideFeedback(@path number: int32, @body feedback: { feedback: string }): void | { @statusCode _: 404 };
}
