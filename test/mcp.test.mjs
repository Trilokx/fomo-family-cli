import test from 'node:test';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {fileURLToPath} from 'node:url';

test('MCP stdio exposes tools and executes capabilities',async()=>{
 const client=new Client({name:'fomo-test',version:'1.0.0'});
 const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../bin/fomo.mjs',import.meta.url)),'mcp'],stderr:'pipe'});
 try {
  await client.connect(transport);
  const {tools}=await client.listTools();
  assert.equal(tools.length,17);
  assert.ok(tools.some(t=>t.name==='fomo_scan'));
  const result=await client.callTool({name:'fomo_capabilities',arguments:{}});
  assert.equal(result.isError,false);
  assert.equal(JSON.parse(result.content[0].text).ok,true);
 }finally{await client.close();}
});
