import json, sys, urllib.parse, urllib.request, time
# key: display ref -> fhl query string
REFS = {
 "彼得前書 3:15":"彼前3:15","約翰福音 11:35":"約11:35","約翰福音 16:33":"約16:33","啟示錄 21:4":"啟21:4",
 "羅馬書 8:28":"羅8:28","詩篇 19:1":"詩19:1","羅馬書 1:20":"羅1:20","創世記 1:1":"創1:1",
 "以弗所書 2:8-9":"弗2:8-9","路加福音 19:10":"路19:10","約翰福音 14:6":"約14:6","使徒行傳 4:12":"徒4:12",
 "創世記 18:25":"創18:25","羅馬書 2:14-15":"羅2:14-15","馬太福音 23:27-28":"太23:27-28","馬可福音 2:17":"可2:17",
 "傳道書 3:11":"傳3:11","馬太福音 16:26":"太16:26","羅馬書 3:23":"羅3:23","羅馬書 6:23":"羅6:23",
 "路加福音 18:9-14":"路18:9-14","提摩太後書 3:16":"提後3:16","哥林多前書 15:3-8":"林前15:3-8",
 "出埃及記 20:12":"出20:12","以弗所書 6:1-3":"弗6:1-3","使徒行傳 16:31":"徒16:31","羅馬書 8:15":"羅8:15",
 "馬太福音 11:28":"太11:28","彼得後書 3:9":"彼後3:9","約翰福音 3:16-18":"約3:16-18","約翰福音 3:16":"約3:16",
 "羅馬書 5:8":"羅5:8","羅馬書 1:19-20":"羅1:19-20","耶利米書 29:13":"耶29:13","創世記 1:27":"創1:27",
 "歌羅西書 1:16-17":"西1:16-17","約翰福音 1:14":"約1:14","羅馬書 3:23-24":"羅3:23-24",
 "路加福音 15:11-24":"路15:11-24","路加福音 24:13-35":"路24:13-35","約翰一書 1:9":"約一1:9",
 "哥林多後書 5:17":"林後5:17","路加福音 23:39-43":"路23:39-43","約翰福音 1:12":"約1:12",
 "羅馬書 10:9":"羅10:9","哥林多前書 15:3-4":"林前15:3-4","約伯記 2:13":"伯2:13","雅各書 1:19":"雅1:19",
}
out = {}
links = {}
for disp, q in REFS.items():
    url = "https://bible.fhl.net/json/qsb.php?" + urllib.parse.urlencode({"qstr": q, "version": "unv", "gb": "0"})
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (gospel_coach verse fetch)"})
    with urllib.request.urlopen(req, timeout=20) as r:
        d = json.load(r)
    recs = d.get("record") or []
    if not recs:
        print("MISSING", disp, q, file=sys.stderr); continue
    links[disp] = {"b": recs[0]["chineses"], "c": recs[0]["chap"]}
    out[disp] = [{"v": f'{x["chap"]}:{x["sec"]}', "t": x["bible_text"]} for x in recs]
    time.sleep(0.2)
js = "// 和合本經文，取自信望愛聖經網 bible.fhl.net（和合本為公有領域）。由 scripts 自動產生，請勿手改。\nwindow.VERSES = " + json.dumps(out, ensure_ascii=False, indent=1) + ";\nwindow.VERSE_LINKS = " + json.dumps(links, ensure_ascii=False) + ";\n"
open(sys.argv[1], "w", encoding="utf-8").write(js)
print("ok", len(out), "refs,", sum(len(v) for v in out.values()), "verses")
