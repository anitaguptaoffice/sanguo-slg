import { expect, it } from "vitest";
import { parseCurrentRecruitQueue, renderCurrentRecruitQueue } from "./currentRecruitQueue";
import { decodeGatewayResponse } from "./decodeGatewayResponse";
import { getTypes } from "./loadProto";

const active = {
  queue_id: 41, unit_cfg_id: 1, count: 5, status: 1, finish_at_ms: Date.UTC(2020, 0, 1),
};
const waiting = { ...active, queue_id: 42, status: 0, finish_at_ms: 0 };

it("preserves the Go empty-wire encoding and the distinction from absence", () => {
  const type = getTypes().GetCityStateResponse;
  const absent = decodeGatewayResponse(type, new Uint8Array());
  const present = decodeGatewayResponse(type, Uint8Array.of(0x2a, 0));
  expect(parseCurrentRecruitQueue(absent.recruit_queue)).toBeNull();
  expect(parseCurrentRecruitQueue(present.recruit_queue)).toEqual({ jobs: [], hasMore: false });
});

it("validates a decoded authoritative prefix and preserves queue-ID order over finish time", () => {
  const type = getTypes().GetCityStateResponse;
  const input = type.fromObject({ recruit_queue: { jobs: [active, waiting] } });
  const state = decodeGatewayResponse(type, type.encode(input).finish());
  expect(parseCurrentRecruitQueue(state.recruit_queue)).toEqual({ jobs: [active, waiting], hasMore: false });
  const jobs = [active, ...Array.from({ length: 63 }, (_, i) => ({ ...waiting, queue_id: 42 + i }))];
  const queue = parseCurrentRecruitQueue({ jobs, has_more: true });
  expect(queue?.jobs).toHaveLength(64);
  const list = document.createElement("ul");
  renderCurrentRecruitQueue(list, queue);
  expect(list.lastElementChild?.textContent).toBe("还有更多排队任务");
});

it.each([
  { jobs: [waiting] },
  { jobs: [active, { ...waiting, queue_id: 41 }] },
  { jobs: [active, { ...waiting, status: 1 }] },
  { jobs: [active, { ...waiting, unit_cfg_id: 5 }] },
  { jobs: [active, { ...waiting, count: 2147483648 }] },
  { jobs: [{ ...active, queue_id: 9007199254740992 }] },
  { jobs: [{ ...active, finish_at_ms: 253402300800000 }] },
  { jobs: [active], has_more: true },
])("invalid data cannot claim queue authority %#", input => {
  expect(parseCurrentRecruitQueue(input)).toBeNull();
});

it("renders elapsed active and waiting work until an authoritative replacement arrives", () => {
  const list = document.createElement("ul");
  renderCurrentRecruitQueue(list, parseCurrentRecruitQueue({ jobs: [active, waiting] }));
  expect(list.querySelector('[data-queue-id="41"]')?.textContent).toContain("训练中");
  expect(list.querySelector('[data-queue-id="42"]')?.textContent).toContain("等待");
  expect(list.textContent).not.toContain("已完成");
  renderCurrentRecruitQueue(list, null);
  expect(list.textContent).toBe("募兵队列待同步");
  renderCurrentRecruitQueue(list, { jobs: [], hasMore: false });
  expect(list.textContent).toBe("暂无募兵");
});
