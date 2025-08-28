// 事件常量定义 - 基于Python版本

// 基础事件前缀
const BASE_AGENT_EVENTS_PREFIX = "agent:lifecycle";
const REACT_AGENT_EVENTS_PREFIX = "agent:lifecycle:step";
const REACT_AGENT_EVENTS_THINK_PREFIX = "agent:lifecycle:step:think";
const REACT_AGENT_EVENTS_ACT_PREFIX = "agent:lifecycle:step:act";
const TOOL_CALL_THINK_AGENT_EVENTS_PREFIX = "agent:lifecycle:step:think:tool";
const TOOL_CALL_ACT_AGENT_EVENTS_PREFIX = "agent:lifecycle:step:act:tool";

// 基础Agent事件
export class BaseAgentEvents {
  // Lifecycle events
  static readonly LIFECYCLE_START = `${BASE_AGENT_EVENTS_PREFIX}:start`;
  static readonly LIFECYCLE_SUMMARY = `${BASE_AGENT_EVENTS_PREFIX}:summary`;
  static readonly LIFECYCLE_PREPARE_START = `${BASE_AGENT_EVENTS_PREFIX}:prepare:start`;
  static readonly LIFECYCLE_PREPARE_PROGRESS = `${BASE_AGENT_EVENTS_PREFIX}:prepare:progress`;
  static readonly LIFECYCLE_PREPARE_COMPLETE = `${BASE_AGENT_EVENTS_PREFIX}:prepare:complete`;
  static readonly LIFECYCLE_PLAN_START = `${BASE_AGENT_EVENTS_PREFIX}:plan:start`;
  static readonly LIFECYCLE_PLAN_COMPLETE = `${BASE_AGENT_EVENTS_PREFIX}:plan:complete`;
  static readonly LIFECYCLE_COMPLETE = `${BASE_AGENT_EVENTS_PREFIX}:complete`;
  static readonly LIFECYCLE_ERROR = `${BASE_AGENT_EVENTS_PREFIX}:error`;
  static readonly LIFECYCLE_TERMINATING = `${BASE_AGENT_EVENTS_PREFIX}:terminating`;
  static readonly LIFECYCLE_TERMINATED = `${BASE_AGENT_EVENTS_PREFIX}:terminated`;

  // State events
  static readonly STATE_CHANGE = `${BASE_AGENT_EVENTS_PREFIX}:state:change`;
  static readonly STATE_STUCK_DETECTED = `${BASE_AGENT_EVENTS_PREFIX}:state:stuck_detected`;
  static readonly STATE_STUCK_HANDLED = `${BASE_AGENT_EVENTS_PREFIX}:state:stuck_handled`;

  // Step events
  static readonly STEP_MAX_REACHED = `${BASE_AGENT_EVENTS_PREFIX}:step_max_reached`;

  // Memory events
  static readonly MEMORY_ADDED = `${BASE_AGENT_EVENTS_PREFIX}:memory:added`;
}

// ReAct Agent事件
export class ReActAgentEvents extends BaseAgentEvents {
  static readonly STEP_START = `${REACT_AGENT_EVENTS_PREFIX}:start`;
  static readonly STEP_COMPLETE = `${REACT_AGENT_EVENTS_PREFIX}:complete`;
  static readonly STEP_ERROR = `${REACT_AGENT_EVENTS_PREFIX}:error`;

  static readonly THINK_START = `${REACT_AGENT_EVENTS_THINK_PREFIX}:start`;
  static readonly THINK_COMPLETE = `${REACT_AGENT_EVENTS_THINK_PREFIX}:complete`;
  static readonly THINK_ERROR = `${REACT_AGENT_EVENTS_THINK_PREFIX}:error`;
  static readonly THINK_TOKEN_COUNT = `${REACT_AGENT_EVENTS_THINK_PREFIX}:token:count`;

  static readonly ACT_START = `${REACT_AGENT_EVENTS_ACT_PREFIX}:start`;
  static readonly ACT_COMPLETE = `${REACT_AGENT_EVENTS_ACT_PREFIX}:complete`;
  static readonly ACT_ERROR = `${REACT_AGENT_EVENTS_ACT_PREFIX}:error`;
  static readonly ACT_TOKEN_COUNT = `${REACT_AGENT_EVENTS_ACT_PREFIX}:token:count`;
}

// 工具调用Agent事件
export class ToolCallAgentEvents extends BaseAgentEvents {
  static readonly TOOL_SELECTED = `${TOOL_CALL_THINK_AGENT_EVENTS_PREFIX}:selected`;

  static readonly TOOL_START = `${TOOL_CALL_ACT_AGENT_EVENTS_PREFIX}:start`;
  static readonly TOOL_COMPLETE = `${TOOL_CALL_ACT_AGENT_EVENTS_PREFIX}:complete`;
  static readonly TOOL_ERROR = `${TOOL_CALL_ACT_AGENT_EVENTS_PREFIX}:error`;
  static readonly TOOL_EXECUTE_START = `${TOOL_CALL_ACT_AGENT_EVENTS_PREFIX}:execute:start`;
  static readonly TOOL_EXECUTE_COMPLETE = `${TOOL_CALL_ACT_AGENT_EVENTS_PREFIX}:execute:complete`;
}
