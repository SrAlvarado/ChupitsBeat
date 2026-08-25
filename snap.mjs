import { chromium } from 'playwright'

const URL = process.env.URL ?? 'http://localhost:5180/'
const OUT = process.env.OUT ?? 'shot.png'
const GENRE = process.env.GENRE ?? ''
const RETUNES = Number(process.env.RETUNES ?? 0)

const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } })
const logs = []
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)

if (GENRE) await page.click(`.genre[data-genre="${GENRE}"]`)
await page.click('#play')
await page.waitForTimeout(8000)

for (let i = 0; i < RETUNES; i++) {
  await page.click('#retune')
  await page.waitForTimeout(4000)
}

await page.screenshot({ path: OUT })

console.log('--- now playing:', await page.textContent('#now-playing'))
if (process.env.SHOW_CODE) {
  console.log('--- código ---')
  console.log(await page.inputValue('#code'))
}
const bad = logs.filter((l) => /error|pageerror|warn.*strudel/i.test(l))
console.log('--- errores:', bad.length ? '\n' + bad.join('\n') : 'ninguno')

await browser.close()
