import { continueGame } from './helpers/opening'
import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  const profile = await page.request.post('/api/v1/profiles', { data: { displayName: 'Explorador' } })
  expect(profile.status()).toBe(201)
  const starter = await page.request.post('/api/v1/profile/starter', { data: { playerDefinitionId: 'starter_leo' } })
  expect(starter.ok()).toBe(true)
})

async function worldState(page: Page) {
  return page.evaluate(async () => {
    // Read the live scene; all movement and interaction below use real keyboard input.
    const entry = '/src/main.ts'
    const { game } = await import(entry)
    const scene = game.scene.getScene('WorldScene')
    if (!scene?.player?.body) return null
    return {
      x: scene.player.x as number,
      y: scene.player.y as number,
      top: scene.player.body.top as number,
      left: scene.player.body.left as number,
      right: scene.player.body.right as number,
      npcLeft: scene.challenger.body.left as number,
      npcX: scene.challenger.x as number,
      npcY: scene.challenger.y as number,
      npcAngle: scene.challenger.angle as number,
      approaching: scene.encounterLocked as boolean,
      scrollX: scene.cameras.main.scrollX as number,
      scrollY: scene.cameras.main.scrollY as number,
      dialogue: scene.hud.isDialogueOpen as boolean,
      velocityX: scene.player.body.velocity.x as number,
      velocityY: scene.player.body.velocity.y as number,
      frame: scene.player.frame.name as string,
      flipX: scene.player.flipX as boolean,
    }
  })
}

test('open map, walk, collide, follow camera and meet the challenger', async ({ page }, testInfo) => {
  const errors: string[] = []
  const commands: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('request', request => { if (request.method() !== 'GET') commands.push(request.url()) })
  await page.goto('/')
  await continueGame(page)
  await expect(page.locator('canvas')).toBeVisible()
  await expect.poll(() => worldState(page)).not.toBeNull()

  await page.keyboard.press('e', { delay: 80 })
  expect((await worldState(page))!.dialogue).toBe(false)

  // The building immediately north of the entry must stop the player at its lower edge.
  await page.keyboard.down('ArrowUp')
  await expect.poll(async () => (await worldState(page))!.y).toBeLessThan(330)
  await page.waitForTimeout(400)
  const wall = (await worldState(page))!
  expect(wall.top).toBeCloseTo(320, 0)
  await page.waitForTimeout(200)
  expect((await worldState(page))!.y).toBeCloseTo(wall.y, 0)
  expect((await worldState(page))!.frame).toBe('back-0')
  await page.keyboard.up('ArrowUp')

  await page.keyboard.down('s')
  await expect.poll(async () => (await worldState(page))!.y, { intervals: [20] }).toBeGreaterThanOrEqual(398)
  await page.keyboard.up('s')
  // Polling can overshoot the row on a busy browser. Align with the NPC's feet
  // through keyboard input before asserting a horizontal body collision.
  for (let correction = 0; correction < 30; correction++) {
    const offset = (await worldState(page))!.y - 400
    if (Math.abs(offset) <= 5) break
    await page.keyboard.press(offset > 0 ? 'w' : 's', { delay: 20 })
  }
  expect(Math.abs((await worldState(page))!.y - 400)).toBeLessThanOrEqual(5)
  await page.keyboard.down('d')
  await expect.poll(async () => (await worldState(page))!.approaching, { timeout: 7000, intervals: [20] }).toBe(true)
  const detected = (await worldState(page))!
  expect(Math.hypot(detected.x - detected.npcX, detected.y - detected.npcY)).toBeGreaterThan(60)
  expect(detected.dialogue).toBe(false)
  expect(detected.npcAngle).toBe(0)
  await page.keyboard.press('e', { delay: 40 })
  expect((await worldState(page))!.dialogue).toBe(false)
  await page.waitForTimeout(280)
  const walking = (await worldState(page))!
  expect(walking.x).toBe(detected.x)
  expect(walking.npcX).toBeLessThan(detected.npcX - 4)
  expect(walking.dialogue).toBe(false)
  await page.screenshot({ path: testInfo.outputPath('npc-approaching.png') })
  await expect.poll(async () => (await worldState(page))!.dialogue, { timeout: 7000, intervals: [20] }).toBe(true)
  await page.keyboard.up('d')
  expect((await worldState(page))!.npcAngle).toBe(0)
  expect((await worldState(page))!.scrollX).toBeGreaterThan(200)

  // Simply approaching Nilo opens his speech; no interaction key or API command.
  await expect.poll(async () => (await worldState(page))!.dialogue).toBe(true)
  const talking = (await worldState(page))!
  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(250)
  expect((await worldState(page))!.x).toBe(talking.x)
  expect((await worldState(page))!.frame).toMatch(/-0$/)
  await page.keyboard.up('ArrowRight')
  await page.screenshot({ path: testInfo.outputPath('dialogue.png') })
  await page.keyboard.press('Escape', { delay: 80 })
  await expect.poll(async () => (await worldState(page))!.dialogue).toBe(false)

  // The NPC becomes solid again after stopping a safe distance from the player.
  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(500)
  await page.keyboard.up('ArrowRight')
  const atNpc = (await worldState(page))!
  expect(atNpc.right).toBeCloseTo(atNpc.npcLeft, 0)
  await page.keyboard.down('e')
  await expect.poll(async () => (await worldState(page))!.dialogue).toBe(true)
  await page.waitForTimeout(250)
  expect((await worldState(page))!.dialogue).toBe(true)
  await page.keyboard.up('e')
  await page.keyboard.press('e', { delay: 80 })
  await expect.poll(async () => (await worldState(page))!.dialogue).toBe(false)
  await page.keyboard.down('ArrowLeft')
  await expect.poll(async () => (await worldState(page))!.x).toBeLessThan(650)
  await page.keyboard.up('ArrowLeft')
  await page.keyboard.down('ArrowRight')
  await expect.poll(async () => (await worldState(page))!.dialogue).toBe(true)
  await page.keyboard.up('ArrowRight')
  await page.keyboard.press('Escape', { delay: 80 })
  await expect.poll(async () => (await worldState(page))!.dialogue).toBe(false)
  await page.waitForTimeout(150)
  expect((await worldState(page))!.dialogue).toBe(false)
  await page.screenshot({ path: testInfo.outputPath('neighborhood.png') })
  expect(commands).toEqual([])
  expect(errors).toEqual([])
})

test('walking alternates poses, faces the travel direction and returns to rest', async ({ page }, testInfo) => {
  await page.goto('/')
  await continueGame(page)
  await expect.poll(() => worldState(page)).not.toBeNull()
  expect((await worldState(page))!.frame).toBe('front-0')

  const frames = new Set<string>()
  await page.keyboard.down('ArrowRight')
  for (let sample = 0; sample < 12; sample++) {
    await page.waitForTimeout(50)
    const state = (await worldState(page))!
    frames.add(state.frame)
    expect(state.flipX).toBe(false)
  }
  expect([...frames].filter(frame => frame.startsWith('side-')).length).toBeGreaterThanOrEqual(3)
  await page.screenshot({ path: testInfo.outputPath('walking.png') })
  await page.keyboard.up('ArrowRight')
  await expect.poll(async () => (await worldState(page))!.frame).toBe('side-0')

  await page.keyboard.down('ArrowLeft')
  await expect.poll(async () => (await worldState(page))!.flipX).toBe(true)
  await page.keyboard.up('ArrowLeft')
  await page.keyboard.down('ArrowDown')
  await expect.poll(async () => (await worldState(page))!.frame).toMatch(/^front-/)
  expect((await worldState(page))!.flipX).toBe(false)
  await page.keyboard.up('ArrowDown')
  await expect.poll(async () => (await worldState(page))!.frame).toBe('front-0')
})

test('map borders stop movement and the camera stays inside the neighborhood', async ({ page }) => {
  await page.goto('/')
  await continueGame(page)
  await expect.poll(() => worldState(page)).not.toBeNull()
  await page.keyboard.down('a')
  await expect.poll(async () => (await worldState(page))!.left, { timeout: 4000 }).toBeLessThanOrEqual(32.1)
  await page.waitForTimeout(150)
  expect((await worldState(page))!.left).toBeCloseTo(32, 0)
  await page.keyboard.up('a')
  await page.keyboard.down('w')
  await expect.poll(async () => (await worldState(page))!.top, { timeout: 5000 }).toBeLessThanOrEqual(32.1)
  await page.keyboard.up('w')
  await expect.poll(async () => (await worldState(page))!.scrollY).toBe(0)
  const edge = (await worldState(page))!
  expect(edge.top).toBeCloseTo(32, 0)
  expect(edge.scrollX).toBe(0)
})

test('houses and residents add city conversations without starting duels', async ({ page }, testInfo) => {
  const commands: string[] = []
  page.on('request', request => { if (request.method() !== 'GET') commands.push(request.url()) })
  await page.goto('/')
  await continueGame(page)
  await expect.poll(() => worldState(page)).not.toBeNull()
  await page.keyboard.down('ArrowLeft')
  // Approach Lia from the west, outside the newer challenger Beto's detection radius.
  await expect.poll(async () => (await worldState(page))!.x, { intervals: [20] }).toBeLessThanOrEqual(64)
  await page.keyboard.up('ArrowLeft')
  await page.keyboard.down('ArrowDown')
  await expect.poll(async () => (await worldState(page))!.y, { intervals: [20] }).toBeGreaterThanOrEqual(444)
  await page.keyboard.up('ArrowDown')
  expect((await worldState(page))!.dialogue).toBe(false)
  await page.keyboard.press('e', { delay: 80 })
  await expect.poll(async () => (await worldState(page))!.dialogue).toBe(true)
  const conversation = () => page.evaluate(async () => {
    const entry = '/src/main.ts'
    const { game } = await import(entry)
    const scene = game.scene.getScene('WorldScene')
    return {
      text: scene.hud.dialogueText.text as string,
      canChallenge: scene.hud.canChallenge as boolean,
      challengeVisible: scene.hud.challengeButton.visible as boolean,
      floatingNames: scene.children.list.filter((child: { text?: string }) => child.text?.includes('· Morador') || child.text?.includes('· Desafiante')).length as number,
      houses: scene.children.list.filter((child: { texture?: { key: string } }) => child.texture?.key === 'house').length as number,
    }
  })
  expect(await conversation()).toMatchObject({ canChallenge: false, challengeVisible: false, houses: 4, floatingNames: 0 })
  expect((await conversation()).text).toContain('Dona Celina · Morador')
  expect((await conversation()).text).toContain('estádio')
  await page.screenshot({ path: testInfo.outputPath('houses-and-resident.png') })
  await page.keyboard.press('Enter', { delay: 80 })
  await expect.poll(async () => (await worldState(page))!.dialogue).toBe(false)
  await expect(page.getByRole('button', { name: 'Iniciar desafio' })).toHaveCount(0)
  await page.keyboard.press('e', { delay: 80 })
  await expect.poll(async () => (await worldState(page))!.dialogue).toBe(true)
  await page.keyboard.press('Escape', { delay: 80 })
  expect(commands).toEqual([])
})

test('enter a house, school, gym and apartment, talk inside and return to the same street', async ({ page }, testInfo) => {
  const commands: string[] = []
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (request.method() !== 'GET') commands.push(request.url()) })
  await page.goto('/')
  await continueGame(page)
  await expect.poll(() => worldState(page)).not.toBeNull()
  const landmarks = await page.evaluate(async () => {
    const { game } = await import('/src/main.ts')
    const world = game.scene.getScene('WorldScene')
    return world.children.list.map((child: { name: string }) => child.name)
  })
  expect(landmarks).toEqual(expect.arrayContaining(['benfica.stadium', 'benfica.lake']))
  await page.evaluate(async () => {
    const { game } = await import('/src/main.ts')
    const world = game.scene.getScene('WorldScene')
    world.player.setPosition(world.stadiumPoint.x - 90, world.stadiumPoint.y)
  })
  await page.waitForTimeout(150)
  await page.screenshot({ path: testInfo.outputPath('stadium-on-map.png') })
  for (const key of ['benfica.house.01.entry', 'benfica.school.entry', 'benfica.gym.entry', 'benfica.apartment.entry']) {
    const before = await page.evaluate(async doorKey => {
      const { game } = await import('/src/main.ts')
      const world = game.scene.getScene('WorldScene')
      const door = world.doors.find((place: { key: string }) => place.key === doorKey)
      world.player.setPosition(door.x, door.y + 15)
      return { x: door.x, y: door.y + 32 }
    }, key)
    await page.keyboard.press('e', { delay: 80 })
    await expect.poll(() => page.evaluate(async () => {
      const { game } = await import('/src/main.ts')
      return game.scene.isActive('InteriorScene')
    })).toBe(true)
    if (key === 'benfica.house.01.entry') {
      await page.getByRole('button', { name: 'Explorar a casa', exact: true }).click()
    }
    if (key === 'benfica.gym.entry') {
      const trainerWords = await page.evaluate(async () => {
        const { game } = await import('/src/main.ts')
        const interior = game.scene.getScene('InteriorScene')
        return interior.dialogue?.list[1]?.text as string
      })
      expect(trainerWords).toContain('Bem-vindo ao Centro de Treinamento!')
      const center = await page.evaluate(async () => {
        const { game } = await import('/src/main.ts')
        const interior = game.scene.getScene('InteriorScene')
        return {
          coaches: interior.people.filter((person: { role?: string }) => person.role === 'trainer').length as number,
          trainees: interior.children.list.filter((child: { name?: string }) => child.name?.startsWith('training-athlete-')).length as number,
        }
      })
      expect(center).toEqual({ coaches: 6, trainees: 0 })
      await page.keyboard.press('Escape', { delay: 80 })
    }
    await page.keyboard.down('ArrowRight')
    await expect.poll(() => page.evaluate(async () => {
      const { game } = await import('/src/main.ts')
      return game.scene.getScene('InteriorScene').player.x as number
    })).toBeGreaterThan(490)
    await page.keyboard.up('ArrowRight')
    const room = await page.evaluate(async () => {
      const { game } = await import('/src/main.ts')
      const interior = game.scene.getScene('InteriorScene')
      const person = interior.people.find((p: { role?: string }) => p.role !== 'tactics-coach')
      interior.player.setPosition(person.sprite.x - 34, person.sprite.y)
      return { people: interior.people.length as number, title: interior.location.name as string }
    })
    expect(room.people).toBeGreaterThanOrEqual(2)
    await page.keyboard.press('e', { delay: 80 })
    await expect.poll(() => page.evaluate(async () => {
      const { game } = await import('/src/main.ts')
      return game.scene.getScene('InteriorScene').dialogue?.visible ?? false
    })).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`${key}.png`) })
    await page.keyboard.press('Escape', { delay: 80 })
    await page.keyboard.press('Escape', { delay: 80 })
    await expect.poll(() => page.evaluate(async () => {
      const { game } = await import('/src/main.ts')
      return game.scene.isActive('WorldScene')
    })).toBe(true)
    expect((await worldState(page))!).toMatchObject(before)
  }
  expect(commands).toEqual([])
  expect(errors).toEqual([])
})
