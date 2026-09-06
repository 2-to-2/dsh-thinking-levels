#!/usr/bin/env node
// 录制代理:转发 dsh -> 网关的请求,检查 developer 角色与 reasoning_effort。
// 用法: node check/record-proxy.mjs --upstream https://gateway.example/v1 [--port 8787]
// 输出: check/requests.jsonl(逐请求体)+ 控制台实时判定。Ctrl+C 结束并打印汇总。

import http from 'node:http';
import { pipeline, Transform } from 'node:stream';
import { createWriteStream } from 'node:fs';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const upstream = new URL(opt('upstream', ''));
if (!upstream.protocol.startsWith('http')) {
  console.error('必须提供 --upstream https://网关/v1');
  process.exit(1);
}
const port = Number(opt('port', 8787));
mkdirSync(here, { recursive: true });
const out = createWriteStream(path.join(here, 'requests.jsonl'), { flags: 'a' });

const stats = { total: 0, developerHits: 0, badRequests: 0, thinkLeaks: 0, efforts: new Map() };

const countOccurrences = (hay, needle) => hay.split(needle).length - 1;

function analyze(body) {
  let parsed;
  try { parsed = JSON.parse(body); } catch { return { parse: false }; }
  const messages = Array.isArray(parsed?.messages) ? parsed.messages : [];
  const roles = messages.map((m) => m?.role).filter(Boolean);
  const developer = roles.filter((r) => r === 'developer').length;
  const effort = parsed?.reasoning_effort ?? null;
  const thinking = parsed?.thinking ?? null;
  const enableThinking = 'enable_thinking' in parsed ? parsed.enable_thinking : null;
  const chatTemplateKwargs = parsed?.chat_template_kwargs ?? null;
  const hasMaxCompletionTokens = 'max_completion_tokens' in parsed;
  const hasMaxTokens = 'max_tokens' in parsed;
  return { parse: true, roles, developer, effort, thinking, enableThinking, chatTemplateKwargs, hasMaxTokens, hasMaxCompletionTokens };
}

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf8');
    const a = analyze(body);
    stats.total++;
    if (a.parse && a.developer > 0) stats.developerHits++;
    if (a.parse && a.effort) stats.efforts.set(a.effort, (stats.efforts.get(a.effort) ?? 0) + 1);

    const record = {
      ts: new Date().toISOString(),
      method: req.method,
      url: req.url,
      ...a,
      body: a.parse ? body : undefined,
    };
    out.write(JSON.stringify(record) + '\n');

    const status = !a.parse ? '非JSON请求体'
      : a.developer > 0 ? `⚠ developer 角色 x${a.developer}(官方路径下必须为 0)`
      : `✓ 无 developer 角色` + (a.effort ? `,reasoning_effort=${a.effort}` : '')
      + (a.enableThinking !== null ? `,enable_thinking=${a.enableThinking}` : '')
      + (a.chatTemplateKwargs ? `,chat_template_kwargs=${JSON.stringify(a.chatTemplateKwargs)}` : '');
    console.log(`[#${stats.total}] ${req.method} ${req.url} -> ${status}`);

    const upReq = http.request(
      {
        protocol: upstream.protocol,
        hostname: upstream.hostname,
        port: upstream.port || (upstream.protocol === 'https:' ? 443 : 80),
        path: upstream.pathname.replace(/\/$/, '') + req.url,
        method: req.method,
        headers: { ...req.headers, host: upstream.host },
      },
      (upRes) => {
        if (upRes.statusCode >= 400) stats.badRequests++;
        res.writeHead(upRes.statusCode, upRes.headers);
        // 缺口候选 1 证据:网关把 thinking 内联进响应(vLLM <think> 形状)
        // 流式分块可能截断标签,计数为下界
        let thinkHits = 0;
        const thinkDetector = new Transform({
          transform(chunk, _enc, cb) {
            thinkHits += countOccurrences(chunk.toString('utf8'), '<think>');
            cb(null, chunk);
          },
        });
        pipeline(upRes, thinkDetector, res, () => {
          if (thinkHits > 0) {
            stats.thinkLeaks++;
            console.log(`[#${stats.total}] ⚠ 响应内联 <think> x${thinkHits}(thinking 文本混入正文,缺口候选 1)`);
          }
        });
      },
    );
    upReq.on('error', (e) => {
      console.error('上游错误:', e.message);
      res.writeHead(502);
      res.end(JSON.stringify({ proxy_error: e.message }));
    });
    upReq.end(body);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`录制代理 http://127.0.0.1:${port} -> ${upstream.href}`);
  console.log(`dsh provider 的 baseURL 设为 http://127.0.0.1:${port}${upstream.pathname}`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log(`\n=== 汇总 ===`);
    console.log(`请求总数: ${stats.total},网关 4xx/5xx: ${stats.badRequests}`);
    console.log(`developer 角色出现请求数: ${stats.developerHits}  ${stats.developerHits === 0 ? '✓ 通过' : '✗ 未通过'}`);
    console.log(`响应内联 <think> 的请求数: ${stats.thinkLeaks}  ${stats.thinkLeaks === 0 ? '✓ 无拆分缺口' : '⚠ 存在拆分缺口(候选 1)'}`);
    console.log(`reasoning_effort 分布:`, Object.fromEntries(stats.efforts));
    out.end();
    process.exit(0);
  });
}
