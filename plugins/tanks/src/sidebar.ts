import IShapeWidgetData = SDK.IShapeWidgetData

let colors = ['#7FFF00', '#6495ED', '#00FFFF', '#FF8C00', '#FF1493', '#228B22', '#DAA520', '#ADFF2F', '#FF69B4', '#4B0082', '#ADD8E6', '#FFB6C1']
let tankImages = [
	'https://habrastorage.org/webt/e9/hq/_j/e9hq_jl2ctnt56wa-wj13p1wrmg.png',
	'https://habrastorage.org/webt/sy/dr/rh/sydrrhdexeipwsse5yfwdbidb-0.png',
	'https://habrastorage.org/webt/5k/9_/0g/5k9_0ge8pkp1f2iepabjvtvs0b0.png',
	'https://habrastorage.org/webt/ye/zh/w6/yezhw6hwh1wxsulk4lhk2xl66xe.png'
]

function getRandomColor() {
	return colors[Math.floor(colors.length * Math.random())]
}

function getRandomImage() {
	return tankImages[Math.floor(tankImages.length * Math.random())]
}

document.getElementById('generate-button')!.addEventListener('click', generateMaze)
document.getElementById('run-button')!.addEventListener('click', run)
let runned = false

async function run() {
	if (runned) {
		runned = true
		return
	}
	let currentTankRotation = 0
	let hasActiveBullet = false
	let updateMoveAvailable = true

	let actions = {
		left: false,
		right: false,
		top: false,
		bottom: false,
		fire: false
	}

	function wipeActions(moveOnly = false) {
		actions.left = false
		actions.right = false
		actions.top = false
		actions.bottom = false
		if (!moveOnly) {
			actions.fire = false
		}
	}

	function onFocusWindow() {
		console.log('onFocusWindow')
		hideClickOnSidebarMessage()
	}

	function onBlurWindow() {
		console.log('onBlurWindow')
		wipeActions(false)
		showClickOnSidebarMessage()
	}

//		let tank = await rtb.board.widgets.images.createByURL(getRandomImage(), {x: 200, y: 200})
	let tank = await rtb.board.widgets.shapes.create({
		width: 180, height: 180, x: 200, y: 200, text: 'A',
		style: {fontSize: 100, backgroundColor: getRandomColor()}
	}) as SDK.WithBaseWidget<IShapeWidgetData>

	window.addEventListener('blur', onBlurWindow)
	window.addEventListener('focus', onFocusWindow)

	window.addEventListener('keydown', (e) => {
		switch (e.keyCode) {
			case 38:
				wipeActions()
				actions.top = true
				break
			case 39:
				wipeActions()
				actions.right = true
				break
			case 40:
				wipeActions()
				actions.bottom = true
				break
			case 37:
				wipeActions()
				actions.left = true
				break
			case 32:
				actions.fire = true
				break
		}
		e.preventDefault()
		e.stopPropagation()
	})
	window.addEventListener('keyup', (e) => {
		switch (e.keyCode) {
			case 38:
				actions.top = false
				break
			case 39:
				actions.right = false
				break
			case 40:
				actions.bottom = false
				break
			case 37:
				actions.left = false
				break
			case 32:
				actions.fire = false
				break
		}
		e.preventDefault()
		e.stopPropagation()
	})

	requestAnimationFrame(tick)

	function tick() {
		updateMove()
		updateFire()
		requestAnimationFrame(tick)
	}

	async function updateFire() {
		if (actions.fire && !hasActiveBullet) {
			hasActiveBullet = true
			createBulletAndRunAnimation().then(() => {
				hasActiveBullet = false
			})
		}
	}

	async function updateMove() {
		if (!updateMoveAvailable) {
			return
		}

		let currentTank = await rtb.board.getById<SDK.WithBaseWidget<IShapeWidgetData>>(tank.id)
		if (!currentTank) {
			(document.querySelector('#you-are-dead') as HTMLElement).style.display = 'block'
			return
		}

		const STEP = 25
		let move = true
		let deltaX = 0
		let deltaY = 0
		let deltaRotation = 0
		if (actions.top) {
			deltaY = -STEP
			deltaRotation = calcDeltaRotation(currentTankRotation, 0)
		} else if (actions.bottom) {
			deltaY = STEP
			deltaRotation = calcDeltaRotation(currentTankRotation, 180)
		} else if (actions.left) {
			deltaX = -STEP
			deltaRotation = calcDeltaRotation(currentTankRotation, 270)
		} else if (actions.right) {
			deltaX = STEP
			deltaRotation = calcDeltaRotation(currentTankRotation, 90)
		} else {
			move = false
		}

		currentTankRotation += deltaRotation

		if (move) {
			let newTankBounds = currentTank.bounds
			newTankBounds.top += deltaY
			newTankBounds.bottom += deltaY
			newTankBounds.left += deltaX
			newTankBounds.right += deltaX
			let tankWillIntersects = await willTankIntersectsWithWall(newTankBounds)

			if (tankWillIntersects) {
				deltaX = 0
				deltaY = 0
			}

			updateMoveAvailable = false
			rtb.board.transformDelta(tank.id, deltaX, deltaY, deltaRotation)
				.then(() => waitMilliseconds(150))
				.then(() => {
					updateMoveAvailable = true
				})
		}
	}

	async function createBulletAndRunAnimation() {
		async function rs(resolve) {
			let MAX_STEPS_COUNT = 20
			let currentStep = 1
			let t = await rtb.board.getById(tank.id) as SDK.WithBaseWidget<IShapeWidgetData>
			let bulletX = t.x
			let bulletY = t.y

			let {bulletDeltaX, bulletDeltaY} = getBulletDirection(t)

			rtb.board.widgets.shapes.create({
				x: bulletX,
				y: bulletY,
				text: 'b',
				width: 30,
				height: 30,
				style: {
					textColor: "#FF0000",
					backgroundColor: "#FF0000"
				}
			}).then(bullet => {
					async function animateBullet() {
						if (currentStep < MAX_STEPS_COUNT) {
							currentStep++
							bulletX += bulletDeltaX
							bulletY += bulletDeltaY
							let b = (await rtb.board.widgets.shapes.update(bullet!.id, {x: bulletX, y: bulletY}))!
							let intersectionObject = await getBulletIntersection(b)
							if (intersectionObject
								&& intersectionObject.id !== b.id
								&& intersectionObject.id !== tank.id) {
								if (canDestoryIntersectionObject(intersectionObject)) {
									rtb.board.deleteById(intersectionObject.id).then((res) => {
										console.log('AAAA', res)
									})
								}
								await runBulletExplosionAnimation()
							} else {
								setTimeout(() => {
									animateBullet()
								}, 50)
							}
						} else {
							await runBulletExplosionAnimation()
						}
					}

					async function runBulletExplosionAnimation() {
						await rtb.board.widgets.shapes.update(bullet!.id, {width: 100, height: 100})
						await waitMilliseconds(20)
						await rtb.board.widgets.shapes.update(bullet!.id, {width: 200, height: 200})
						await waitMilliseconds(20)
						await rtb.board.widgets.shapes.update(bullet!.id, {width: 300, height: 300})
						await rtb.board.deleteById(bullet!.id)
						resolve()
					}

					function canDestoryIntersectionObject(intersectionObject) {
						// не может разрущать пули и неразрушимые блоки
						return !(intersectionObject.type === 'SHAPE' && (intersectionObject.text === 'N' || intersectionObject.text === 'b'))
					}

					animateBullet()
				}
			)
		}

		return new Promise(rs)
	}

	function getBulletDirection(t) {
		const BULLET_STEP = 60
		if (t.rotation === 0) { // top
			return {bulletDeltaX: 0, bulletDeltaY: -BULLET_STEP}
		} else if (t.rotation === 90) { // right
			return {bulletDeltaX: BULLET_STEP, bulletDeltaY: 0}
		} else if (t.rotation === 180) { // bottom
			return {bulletDeltaX: 0, bulletDeltaY: BULLET_STEP}
		} else { // left
			return {bulletDeltaX: -BULLET_STEP, bulletDeltaY: 0}
		}
	}

	function calcDeltaRotation(currentTankRotation, targetAngle) {
		return targetAngle - currentTankRotation
	}

}

function waitMilliseconds(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms)
	})
}

////////////////////////////////////////////////////////////////
// Maze generation
////////////////////////////////////////////////////////////////

const B_N = 0 // не разрушаемый
const B_D = 1 // разрушаемый
const B_E = 2 // пустой

const initMazeGrid = [
	[B_N, B_N, B_N, B_N, B_N, B_N, B_N, B_N, B_N, B_N, B_N, B_N, B_N],
	[B_N, B_E, B_D, B_E, B_E, B_E, B_E, B_E, B_D, B_E, B_D, B_E, B_N],
	[B_N, B_E, B_D, B_E, B_D, B_D, B_D, B_E, B_D, B_E, B_D, B_E, B_N],
	[B_N, B_E, B_D, B_E, B_D, B_D, B_D, B_E, B_D, B_E, B_D, B_E, B_N],
	[B_N, B_E, B_D, B_E, B_N, B_D, B_N, B_E, B_D, B_E, B_D, B_E, B_N],
	[B_N, B_E, B_E, B_E, B_D, B_D, B_D, B_E, B_E, B_E, B_E, B_E, B_N],
	[B_N, B_D, B_D, B_E, B_N, B_N, B_N, B_D, B_D, B_D, B_D, B_E, B_N],
	[B_N, B_D, B_D, B_E, B_D, B_D, B_D, B_D, B_D, B_D, B_D, B_E, B_N],
	[B_N, B_E, B_D, B_E, B_D, B_E, B_E, B_E, B_D, B_E, B_D, B_E, B_N],
	[B_N, B_E, B_D, B_E, B_D, B_E, B_E, B_E, B_D, B_E, B_D, B_E, B_N],
	[B_N, B_E, B_D, B_E, B_D, B_E, B_E, B_E, B_D, B_E, B_D, B_E, B_N],
	[B_N, B_E, B_E, B_E, B_E, B_E, B_E, B_E, B_E, B_E, B_E, B_E, B_N],
	[B_N, B_E, B_E, B_D, B_D, B_D, B_D, B_E, B_E, B_E, B_E, B_D, B_N],
	[B_N, B_N, B_N, B_N, B_N, B_N, B_N, B_N, B_N, B_N, B_N, B_N, B_N]
]

const mazeBlocks:SDK.WithBaseWidget<IShapeWidgetData>[][] = []

async function generateMaze() {
	const BLOCK_SIZE = 200
	let block0Info = {
		width: BLOCK_SIZE,
		height: BLOCK_SIZE,
		text: 'N',
		style: {
			borderWidth: 0,
			backgroundColor: '#751814',
			textColor: '#751814'
		}
	}
	let block1Info = {
		width: BLOCK_SIZE,
		height: BLOCK_SIZE,
		text: 'D',
		style: {
			borderWidth: 0,
			backgroundColor: '#eacc68',
			textColor: '#eacc68'
		}
	}

	let iMax = initMazeGrid.length
	let jMax = initMazeGrid[0].length
	for (let i = 0; i < iMax; i++) { // по вертикали
		for (let j = 0; j < jMax; j++) { // по горизонтали
			let block = initMazeGrid[i][j]
			if (block !== B_E) {
				let data = block === B_N ? block0Info : block1Info
				if (mazeBlocks[i] === undefined) {
					mazeBlocks[i] = []
				}
				mazeBlocks[i][j] = (await rtb.board.widgets.shapes.create(Object.assign({}, data, {x: BLOCK_SIZE * j, y: BLOCK_SIZE * i})))!
			}
		}
	}
}

// пули проверять со стенами и вражискими танками
async function getBulletIntersection(bullet:SDK.IBaseWidget):Promise<SDK.IBaseWidget> {
	let widgets = await rtb.board.widgets.get()
	return widgets.find(block => isObjectsIntersect(bullet.bounds, block.bounds))!
}

// танки проверять со стенами
async function willTankIntersectsWithWall(tankBounds:IBounds):Promise<boolean> {
	let widgets = await rtb.board.widgets.get()
	return widgets
		.filter((w:SDK.WithBaseWidget<IShapeWidgetData>) => w.type === 'SHAPE' && (w.text === 'D' || w.text === 'N'))
		.some(block => isObjectsIntersect(tankBounds, block.bounds))
}

function isObjectsIntersect(objectA:IBounds, objectB:IBounds) {
	return isSegmentsIntersect(objectA.top, objectA.bottom, objectB.top, objectB.bottom)
		&& isSegmentsIntersect(objectA.left, objectA.right, objectB.left, objectB.right)
}

function isSegmentsIntersect(a1, b1, a2, b2) {
	return !(b1 < a2 || a1 > b2)
}

function showClickOnSidebarMessage() {
	(document.querySelector('#click-for-focus') as HTMLElement).style.display = 'block'
}

function hideClickOnSidebarMessage() {
	(document.querySelector('#click-for-focus') as HTMLElement).style!.display = 'none'
}
