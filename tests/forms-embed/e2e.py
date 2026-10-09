import os, json, urllib.request
os.environ["PLAYWRIGHT_BROWSERS_PATH"] = "/opt/pw-browsers"
from playwright.sync_api import sync_playwright
results = []
def check(name, cond, detail=""):
    results.append((("PASS" if cond else "FAIL"), name, detail))
def fill(p, name="Asha", svc="SEO"):
    p.fill("[name=name]", name); p.fill("[name=email]", "asha@example.com")
    p.select_option("[name=field_4]", svc); p.fill("[name=message]", "Need help with SEO")
with sync_playwright() as pw:
    b = pw.chromium.launch()
    for mode in ["html", "stripped", "inline"]:
        p = b.new_page(); errs = []
        p.on("pageerror", lambda e: errs.append(str(e)))
        p.goto(f"http://127.0.0.1:8080/{mode}")
        p.wait_for_selector("select.gv-select")
        opts = p.eval_on_selector_all("select.gv-select option", "els => els.map(e => e.textContent)")
        check(f"{mode}: dropdown is a real <select> with options", opts[1:] == ["SEO", "Ads & Social"] and opts[0] in ("Choose an option", "Choose…"), str(opts))
        border = p.eval_on_selector("select.gv-select", "e => getComputedStyle(e).borderTopColor")
        check(f"{mode}: website CSS styles the dropdown", border == "rgb(255, 0, 0)", border)
        fill(p); p.click("button.gv-button")
        if mode == "stripped":
            p.wait_for_timeout(1500)
            fr = p.frame(name="gv-form-b29370d3-frame"); txt = fr.inner_text("body") if fr else ""
        else:
            p.wait_for_selector(".gv-success", timeout=8000); txt = p.inner_text(".gv-success")
        check(f"{mode}: stays on the client website", p.url.startswith("http://127.0.0.1:8080/"), p.url)
        check(f"{mode}: thank-you shown in place", "Thanks — message sent!" in txt, txt.replace("\n"," "))
        check(f"{mode}: no JS errors", not errs, "; ".join(errs))
        if mode == "html":
            check("html: status frame hidden when JavaScript runs", p.evaluate("document.getElementsByName('gv-form-b29370d3-frame')[0].style.display") == "none")
        # error path
        p2 = b.new_page(); p2.goto(f"http://127.0.0.1:8080/{mode}"); p2.wait_for_selector("select.gv-select")
        fill(p2, name="fail"); p2.click("button.gv-button")
        if mode == "stripped":
            p2.wait_for_timeout(1500); fr = p2.frame(name="gv-form-b29370d3-frame")
            check(f"{mode}: error shown in place", "Please fill in" in fr.inner_text("body"), fr.inner_text("body"))
            check(f"{mode}: error keeps visitor on the site", p2.url.startswith("http://127.0.0.1:8080/"), p2.url)
        else:
            p2.wait_for_selector(".gv-error:not([hidden])", timeout=8000)
            check(f"{mode}: error shown inline", "Please fill in" in p2.inner_text(".gv-error"), p2.inner_text(".gv-error"))
            check(f"{mode}: error keeps visitor on the site", p2.url.startswith("http://127.0.0.1:8080/"), p2.url)
    b.close()
calls = json.load(urllib.request.urlopen("http://127.0.0.1:3100/__calls"))
check("server: bot check not demanded from the client website", all(c["ctx"].get("growviaPage") is False for c in calls), str([c["ctx"].get("growviaPage") for c in calls]))
check("server: dropdown value received", any(c["data"].get("field_4") == "SEO" for c in calls))
for r in results: print(*r, sep=" | ")
print(sum(r[0]=="PASS" for r in results), "/", len(results), "passed")
