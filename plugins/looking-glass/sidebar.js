rtb.onReady(() => {
	rtb.addListener(rtb.enums.event.SELECTION_UPDATED, getWidget)
	getWidget()
})

async function getWidget() {
	let widget = await rtb.board.getSelection()
	let text = widget[0]['text']
	const widgetText = document.getElementById('widget-text')
	widgetText.value = String(text)
}

