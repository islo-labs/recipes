from __future__ import annotations

from playwright.sync_api import sync_playwright


def test_counter_increments(base_url: str) -> None:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(base_url)
        assert page.locator("#title").inner_text() == "Counter"
        assert page.locator("#count").inner_text() == "0"
        page.locator("#increment").click()
        assert page.locator("#count").inner_text() == "1"
        page.screenshot(path="/tmp/e2e-screenshot.png")
        browser.close()
