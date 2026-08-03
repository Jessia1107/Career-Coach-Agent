# Job Tracker 与面试工作流实施计划

> **For agentic workers:** REQUIRED: Use `superpowers:subagent-driven-development` (if subagents available) or `superpowers:executing-plans` to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 为 Career Coach Agent 增加本地 job tracker、岗位判断/去重、简历复用元数据，以及 interview-start / interview-review 的最小闭环。

**架构：** `jobs/job_tracker.json` 是机器可读的 source of truth，`jobs/job_tracker.md` 是用户可检查的视图。CLI 负责把用户输入转成 tracker 操作，现有 provider 只负责需要模型判断或生成内容的部分；普通申请不保存“已提交到外部网站”的假设，只在生成或复用简历后把内部状态记为 `applied`。

**技术栈：** Node.js CommonJS、Node built-in test runner、JSON/Markdown 本地文件、现有 Career Coach provider 抽象。

---

## Chunk 1：Tracker 数据层

### Task 1：定义 tracker schema 与规范化函数

**Files:**
- Create: `career_agent/tracker.js`
- Test: `tests/career_agent_tracker.test.js`

- [ ] 写失败测试：默认 tracker、状态枚举、岗位记录的必填字段和旧数据规范化。
- [ ] 运行 `node --test tests/career_agent_tracker.test.js`，确认因模块不存在或字段缺失失败。
- [ ] 实现 `createDefaultTracker`、`normalizeJobRecord`、`normalizeTracker`。
- [ ] 运行单文件测试，确认通过。

### Task 2：读写 tracker 与用户可读 Markdown

**Files:**
- Modify: `career_agent/tracker.js`
- Modify: `career_agent/state.js`
- Test: `tests/career_agent_tracker.test.js`

- [ ] 写失败测试：`loadTracker` 在文件不存在时创建空 tracker，`saveTracker` 写入 JSON 和 Markdown，且原始 JD 文本保留。
- [ ] 运行测试确认失败。
- [ ] 实现 `getTrackerPaths`、`loadTracker`、`saveTracker`、`renderTrackerMarkdown`。
- [ ] 在 `getSessionPaths` 的同一 root 下增加 `jobs/` 路径，不改变现有 session 文件位置。
- [ ] 运行测试确认通过。

## Chunk 2：岗位判断、去重和简历复用

### Task 3：JD fingerprint 与重复岗位查找

**Files:**
- Modify: `career_agent/tracker.js`
- Test: `tests/career_agent_tracker.test.js`

- [ ] 写失败测试：相同公司/岗位/JD 归一化后 fingerprint 一致；重复岗位返回既有记录。
- [ ] 运行测试确认失败。
- [ ] 用 Node `crypto` 实现文本归一化和 SHA-256 fingerprint；实现 `findDuplicateJob`。
- [ ] 运行测试确认通过。

### Task 4：岗位判断命令与 resume 复用元数据

**Files:**
- Modify: `career_agent/cli.js`
- Modify: `career_agent/agent.js`
- Modify: `career_agent/tasks.js`
- Modify: `career_agent/state.js`
- Test: `tests/career_agent_cli.test.js`
- Test: `tests/career_agent_agent.test.js`

- [ ] 写失败测试：`judge-job` 保存 `apply_now`、`do_not_apply` 或 `future_target`；明确 duplicate 时不调用 provider；apply_now 在生成/复用简历后保存 `applied`。
- [ ] 运行测试确认失败。
- [ ] 增加 `judge-job --company --role --jd-file` 参数解析和 tracker 持久化。
- [ ] 增加岗位判断 prompt，明确 sponsor/location 未写不构成拒绝条件，只有明确 hard red flag 才是 `do_not_apply`。
- [ ] 增加 `resumeStatus`、`resumePath`、`resumeReusedFrom`、`similarityScore` 字段；本阶段只持久化元数据，不伪造外部投递。
- [ ] 运行相关测试确认通过。

## Chunk 3：面试触发与面试复盘

### Task 5：interview-start

**Files:**
- Modify: `career_agent/cli.js`
- Modify: `career_agent/agent.js`
- Modify: `career_agent/tasks.js`
- Modify: `career_agent/tracker.js`
- Test: `tests/career_agent_cli.test.js`

- [ ] 写失败测试：按公司/岗位找到 tracker 记录，调用 provider 时 prompt 包含已保存 JD、resume、career goal 和 interviewer 输入；完成后状态变为 `interviewing`。
- [ ] 运行测试确认失败。
- [ ] 实现 `interview-start --company --role [--interviewer]`，缺少岗位时返回可操作错误。
- [ ] 运行测试确认通过。

### Task 6：interview-review

**Files:**
- Modify: `career_agent/cli.js`
- Modify: `career_agent/agent.js`
- Modify: `career_agent/tasks.js`
- Modify: `career_agent/tracker.js`
- Test: `tests/career_agent_cli.test.js`

- [ ] 写失败测试：只提供公司、岗位和 transcript 时，prompt 自动加载 tracker 上下文；输出保存到岗位记录，状态变为 `interviewed`。
- [ ] 运行测试确认失败。
- [ ] 实现 `interview-review --company --role --transcript-file`，保存表现总结、强弱答案、错失机会和下一步行动。
- [ ] 增加后续 `offer` 与 `rejected_after_interview` 状态更新的最小入口。
- [ ] 运行测试确认通过。

## Chunk 4：导出、清理与验证

### Task 7：tracker 查看和 90 天清理

**Files:**
- Modify: `career_agent/cli.js`
- Modify: `career_agent/tracker.js`
- Modify: `README.md`
- Test: `tests/career_agent_tracker.test.js`

- [ ] 写失败测试：`tracker` 输出用户可读列表；`cleanup` 只处理超过 90 天且未进入面试的岗位，保留 fingerprint 和轻量元数据。
- [ ] 运行测试确认失败。
- [ ] 实现 `tracker` 与 `cleanup`；保留 `interviewing`、`interviewed`、`offer`、`rejected_after_interview` 的完整 artifacts。
- [ ] 更新 README 的命令和状态说明。
- [ ] 运行完整测试 `node --test tests/*.test.js`，记录结果和剩余限制。

