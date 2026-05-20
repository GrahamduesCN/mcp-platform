#!/usr/bin/env python3
"""将 test.html 中的假数据替换为从 registry.json 动态加载的真数据"""
import json, re

with open("web/registry.json") as f:
    servers = json.load(f)["servers"]

with open("web/index.html") as f:
    html = f.read()

# 替换硬编码的服务器卡片为动态加载
old_cards = re.search(r'<div class="server-grid">.*?</div>\s*</section>', html, re.DOTALL)
if old_cards:
    new_section = '''<div id="server-grid" class="server-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
  <p style="grid-column: 1/-1; color: var(--color-text-secondary);">Loading servers from registry...</p>
</div>
</section>
<script>
fetch("registry.json").then(function(r){return r.json()}).then(function(data){
  var g = document.getElementById("server-grid");
  g.innerHTML = data.slice(0,6).map(function(s){
    return '<div class="server-card" style="background:var(--color-bg-secondary);border-radius:12px;padding:20px;border:0.5px solid var(--color-border)"><h3 style="font-size:15px;margin:0 0 8px">'+s.name+'</h3><p style="font-size:13px;color:var(--color-text-secondary);margin:0 0 12px">'+s.description+'</p><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">'+s.tags.map(function(t){return \'<span style="font-size:11px;background:var(--color-bg-tertiary);padding:2px 8px;border-radius:4px">#\'+t+\'</span>\'}).join("")+'</div><div style="font-size:12px;color:var(--color-text-tertiary);margin-bottom:12px">v'+s.version+' | '+s.downloads.toLocaleString()+' installs</div><a href="server.html?id='+encodeURIComponent(s.name)+'" style="font-size:13px;color:var(--color-accent)">View details</a></div>';
  }).join("");
});
</script>'''
    html = html.replace(old_cards.group(0), new_section)

with open("web/index.html", "w") as f:
    f.write(html)

print("Updated web/index.html - now loads real data from registry.json")
