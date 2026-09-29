// global variables

const RangeForTransY = 15;

const ImgCount = [287, 374];

// cloudflare defalut bucket url

const Basic_URL = 'https://pub-b7f3edbf1c224a028525eec6746ddd09.r2.dev/';

// [startRatio, endRatio, startValue, endValue]
type Range = [number, number, number, number];

interface MessageValue {
	opacityIn: Range;
	opacityOut: Range;
	translateYIn: Range;
	translateYOut: Range;
	threshold: number;
}

interface FadeVideoValue {
	opacityIn: Range;
	opacityOut: Range;
	threshold: number;
	SR: number;
	WR?: number;
}

interface RotateVideoValue {
	threshold: [number, number];
	rotateIn: number;
	rotateOut: number;
	translateYIn: number;
	translateYOut: number;
	SR: number;
	WR: number;
	fixedWidth: number;
}

interface Scene<O, V> {
	type: 'sticky';
	height: number;
	heightMultiple: number;
	obj: O & { scene: HTMLElement };
	value: V;
}

type Scene0 = Scene<
	{
		v1: HTMLCanvasElement;
		message1: HTMLElement;
		message2: HTMLElement;
		message3: HTMLElement;
	},
	{ v1: FadeVideoValue; m1: MessageValue; m2: MessageValue; m3: MessageValue }
>;

type Scene1 = Scene<
	{
		v2: HTMLVideoElement;
		message1: HTMLElement;
		message2: HTMLElement;
		message3: HTMLElement;
		message4: HTMLElement;
		message5: HTMLElement;
	},
	{
		v2: FadeVideoValue;
		m1: MessageValue;
		m2: MessageValue;
		m3: MessageValue;
		m4: MessageValue;
		m5: MessageValue;
	}
>;

type Scene2 = Scene<
	{
		v3: HTMLVideoElement;
		v4: HTMLVideoElement;
		v5: HTMLVideoElement;
		v6: HTMLCanvasElement;
	} & Record<`message${number}`, HTMLElement>,
	{
		v3: FadeVideoValue & { WR: number };
		v4: RotateVideoValue;
		v5: RotateVideoValue;
		v6: FadeVideoValue & { WR: number; videoIndex: Range };
	} & Record<`m${number}`, MessageValue>
>;

type Scene3 = Scene<
	{ v7: HTMLCanvasElement; m1: HTMLElement },
	{
		v7: { SR: number; WR: number; opacityIn: Range; overpaintingIn: Range };
		m1: MessageValue;
	}
>;

type SceneArr = [Scene0, Scene1, Scene2, Scene3];

const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => {
	const elem = document.querySelector<T>(selector);
	if (!elem) throw new Error(`Element not found: ${selector}`);
	return elem;
};

const createSceneArr = (): SceneArr => [
	// Scene 0
	{
		type: 'sticky',
		height: 0,
		heightMultiple: 5,
		obj: {
			scene: $('.scene0'),
			v1: $<HTMLCanvasElement>('.scene0 .video'),
			message1: $('.scene0 .message_1'),
			message2: $('.scene0 .message_2'),
			message3: $('.scene0 .message_3'),
		},
		// stR enR stV edV
		value: {
			v1: {
				opacityIn: [0, 0.1, 0, 1],
				opacityOut: [0.9, 1, 1, 0],
				threshold: 0.5,
				SR: 0,
			},
			// message 1 (0.1 ~ 0.3)
			m1: {
				opacityIn: [0.1, 0.15, 0, 1],
				opacityOut: [0.25, 0.3, 1, 0],
				translateYIn: [0.1, 0.15, RangeForTransY, 0],
				translateYOut: [0.25, 0.3, 0, -RangeForTransY],
				threshold: 0.2,
			},
			// message 2 (0.35 ~ 0.55)
			m2: {
				opacityIn: [0.35, 0.4, 0, 1],
				opacityOut: [0.5, 0.55, 1, 0],
				translateYIn: [0.35, 0.4, RangeForTransY, 0],
				translateYOut: [0.5, 0.55, 0, -RangeForTransY],
				threshold: 0.45,
			},
			// message 3 (0.6 ~ 0.8)
			m3: {
				opacityIn: [0.6, 0.65, 0, 1],
				opacityOut: [0.75, 0.8, 1, 0],
				translateYIn: [0.6, 0.65, RangeForTransY, 0],
				translateYOut: [0.75, 0.8, 0, -RangeForTransY],
				threshold: 0.7,
			},
		},
	},
	// Scene 1
	{
		type: 'sticky',
		height: 0,

		heightMultiple: 5,
		obj: {
			scene: $('.scene1'),
			v2: $<HTMLVideoElement>('.scene1 .video_elem'),
			message1: $('.scene1 .message_1'),
			message2: $('.scene1 .message_2'),
			message3: $('.scene1 .message_3'),
			message4: $('.scene1 .message_4'),
			message5: $('.scene1 .message_5'),
		},
		value: {
			// for Video
			v2: {
				opacityIn: [0, 0.1, 0, 1],
				opacityOut: [0.9, 1, 1, 0],
				threshold: 0.5,
				SR: 0,
			},
			// message 1 (0.05 ~ 0.2)
			m1: {
				opacityIn: [0.05, 0.1, 0, 1],
				opacityOut: [0.15, 0.2, 1, 0],
				translateYIn: [0.05, 0.1, RangeForTransY, 0],
				translateYOut: [0.15, 0.2, 0, -RangeForTransY],
				threshold: 0.13,
			},
			// message 2 (0.23 ~ 0.38)
			m2: {
				opacityIn: [0.23, 0.28, 0, 1],
				opacityOut: [0.33, 0.38, 1, 0],
				translateYIn: [0.23, 0.28, RangeForTransY, 0],
				translateYOut: [0.33, 0.38, 0, -RangeForTransY],
				threshold: 0.31,
			},
			// message 3 (0.41 ~ 0.56)
			m3: {
				opacityIn: [0.41, 0.46, 0, 1],
				opacityOut: [0.51, 0.56, 1, 0],
				translateYIn: [0.41, 0.46, RangeForTransY, 0],
				translateYOut: [0.51, 0.56, 0, -RangeForTransY],
				threshold: 0.48,
			},
			// message 4 (0.59 ~ 0.74)
			m4: {
				opacityIn: [0.59, 0.64, 0, 1],
				opacityOut: [0.69, 0.74, 1, 0],
				translateYIn: [0.59, 0.64, RangeForTransY, 0],
				translateYOut: [0.69, 0.74, 0, -RangeForTransY],
				threshold: 0.67,
			},
			// message 5(0.77 ~ 0.92)
			m5: {
				opacityIn: [0.77, 0.82, 0, 1],
				opacityOut: [0.87, 0.92, 1, 0],
				translateYIn: [0.77, 0.82, RangeForTransY, 0],
				translateYOut: [0.87, 0.92, 0, -RangeForTransY],
				threshold: 0.9,
			},
		},
	},
	// Scene 2
	{
		type: 'sticky',
		height: 0,
		heightMultiple: 15,
		obj: {
			scene: $('.scene2'),
			v3: $<HTMLVideoElement>('.video_1'), // 0 ~ 0.2
			message1: $('.video1_message1'),
			message2: $('.video1_message2'),
			message3: $('.video1_message3'),
			message4: $('.video1_message4'),
			message5: $('.video1_message5'),
			v4: $<HTMLVideoElement>('.video_2'), // 0.2 ~ 0.45
			message6: $('.video2_message1'),
			message7: $('.video2_message2'),
			message8: $('.video2_message3'),
			message9: $('.video2_message4'),
			message10: $('.video2_message5'),
			v5: $<HTMLVideoElement>('.video_3'), // 0.5 ~ 0.75
			message11: $('.video3_message1'),
			message12: $('.video3_message2'),
			message13: $('.video3_message3'),
			message14: $('.video3_message4'),
			message15: $('.video3_message5'),
			v6: $<HTMLCanvasElement>('.video_4'), // 0.75 ~ 1
		},
		value: {
			v3: {
				// 0.1 ~ 0.3
				opacityIn: [0, 0.1, 0, 1],
				opacityOut: [0.5, 0.55, 1, 0],
				threshold: 0.3,
				SR: 0,
				WR: 0,
			},
			// message 1 (0.1 ~ 0.14)
			m1: {
				opacityIn: [0.1, 0.11, 0, 1],
				opacityOut: [0.13, 0.14, 1, 0],
				translateYIn: [0.1, 0.11, RangeForTransY, 0],
				translateYOut: [0.13, 0.14, 0, -RangeForTransY],
				threshold: 0.12,
			},
			// message 2 (0.14 ~ 0.18)
			m2: {
				opacityIn: [0.14, 0.15, 0, 1],
				opacityOut: [0.17, 0.18, 1, 0],
				translateYIn: [0.14, 0.15, RangeForTransY, 0],
				translateYOut: [0.17, 0.18, 0, -RangeForTransY],
				threshold: 0.16,
			},
			// message 3 (0.18 ~ 0.22)
			m3: {
				opacityIn: [0.18, 0.19, 0, 1],
				opacityOut: [0.21, 0.22, 1, 0],
				translateYIn: [0.18, 0.19, RangeForTransY, 0],
				translateYOut: [0.21, 0.22, 0, -RangeForTransY],
				threshold: 0.2,
			},
			// message 4 (0.22 ~ 0.26)
			m4: {
				opacityIn: [0.22, 0.23, 0, 1],
				opacityOut: [0.25, 0.26, 1, 0],
				translateYIn: [0.22, 0.23, RangeForTransY, 0],
				translateYOut: [0.25, 0.26, 0, -RangeForTransY],
				threshold: 0.24,
			},
			// message 5(0.26 ~ 0.3)
			m5: {
				opacityIn: [0.26, 0.27, 0, 1],
				opacityOut: [0.29, 0.3, 1, 0],
				translateYIn: [0.26, 0.27, RangeForTransY, 0],
				translateYOut: [0.29, 0.3, 0, -RangeForTransY],
				threshold: 0.28,
			},
			v4: {
				threshold: [0.3, 0.75], // videoIn(0.3) -> v5In(Overpainting)(0.5) -> videoOut(0.75)
				rotateIn: 90,
				rotateOut: 0,
				// translateY(In, Out) will be adjusted after "setSize" method executed
				translateYIn: 0,
				translateYOut: 0,
				SR: 0,
				WR: 0,
				fixedWidth: 0,
			},
			// message 6 (0.3 ~ 0.34)
			m6: {
				opacityIn: [0.3, 0.31, 0, 1],
				opacityOut: [0.33, 0.34, 1, 0],
				translateYIn: [0.3, 0.31, RangeForTransY, 0],
				translateYOut: [0.33, 0.34, 0, -RangeForTransY],
				threshold: 0.32,
			},
			// message 7 (0.34 ~ 0.38)
			m7: {
				opacityIn: [0.34, 0.35, 0, 1],
				opacityOut: [0.37, 0.38, 1, 0],
				translateYIn: [0.34, 0.35, RangeForTransY, 0],
				translateYOut: [0.37, 0.38, 0, -RangeForTransY],
				threshold: 0.36,
			},
			// message 8 (0.38 ~ 0.42)
			m8: {
				opacityIn: [0.38, 0.39, 0, 1],
				opacityOut: [0.41, 0.42, 1, 0],
				translateYIn: [0.38, 0.39, RangeForTransY, 0],
				translateYOut: [0.41, 0.42, 0, -RangeForTransY],
				threshold: 0.4,
			},
			// message 9 (0.42 ~ 0.46)
			m9: {
				opacityIn: [0.42, 0.43, 0, 1],
				opacityOut: [0.45, 0.46, 1, 0],
				translateYIn: [0.42, 0.43, RangeForTransY, 0],
				translateYOut: [0.45, 0.46, 0, -RangeForTransY],
				threshold: 0.44,
			},
			// message 10 (0.46 ~ 0.5)
			m10: {
				opacityIn: [0.46, 0.47, 0, 1],
				opacityOut: [0.49, 0.5, 1, 0],
				translateYIn: [0.46, 0.47, RangeForTransY, 0],
				translateYOut: [0.49, 0.5, 0, -RangeForTransY],
				threshold: 0.48,
			},
			v5: {
				threshold: [0.5, 0.75], // videoIn(0.5) -> videoOut(0.75)
				rotateIn: 90,
				rotateOut: 0,
				// translateY(In, Out) will be adjusted after "setSize" method executed
				translateYIn: 0,
				translateYOut: 0,
				SR: 0,
				WR: 0,
				fixedWidth: 0,
			},
			// message 11 (0.5 ~ 0.55)
			m11: {
				opacityIn: [0.5, 0.51, 0, 1],
				opacityOut: [0.54, 0.55, 1, 0],
				translateYIn: [0.5, 0.51, RangeForTransY, 0],
				translateYOut: [0.54, 0.55, 0, -RangeForTransY],
				threshold: 0.525,
			},
			// message 12 (0.55 ~ 0.6)
			m12: {
				opacityIn: [0.55, 0.56, 0, 1],
				opacityOut: [0.59, 0.6, 1, 0],
				translateYIn: [0.55, 0.56, RangeForTransY, 0],
				translateYOut: [0.59, 0.6, 0, -RangeForTransY],
				threshold: 0.575,
			},
			// message 13 (0.6 ~ 0.65)
			m13: {
				opacityIn: [0.6, 0.61, 0, 1],
				opacityOut: [0.64, 0.65, 1, 0],
				translateYIn: [0.6, 0.61, RangeForTransY, 0],
				translateYOut: [0.64, 0.65, 0, -RangeForTransY],
				threshold: 0.625,
			},
			// message 14 (0.65 ~ 0.7)
			m14: {
				opacityIn: [0.65, 0.66, 0, 1],
				opacityOut: [0.69, 0.7, 1, 0],
				translateYIn: [0.65, 0.66, RangeForTransY, 0],
				translateYOut: [0.69, 0.7, 0, -RangeForTransY],
				threshold: 0.675,
			},
			// message 15(0.7 ~ 0.75)
			m15: {
				opacityIn: [0.7, 0.71, 0, 1],
				opacityOut: [0.74, 0.75, 1, 0],
				translateYIn: [0.7, 0.71, RangeForTransY, 0],
				translateYOut: [0.74, 0.75, 0, -RangeForTransY],
				threshold: 0.725,
			},
			v6: {
				// canvas_elem (0.75 ~ 1)
				threshold: 0.8,
				videoIndex: [0.75, 0.95, 0, ImgCount[1] - 1],
				opacityIn: [0.55, 0.6, 0, 1],
				opacityOut: [0.9, 1, 1, 0],
				SR: 0,
				WR: 0,
			},
		},
	},
	{
		// Scene 3
		type: 'sticky',
		height: 0,
		heightMultiple: 3,
		obj: {
			scene: $('.scene3'),
			v7: $<HTMLCanvasElement>('.scene3 .video'),
			m1: $('.scene3 .video4_message1'),
		},
		value: {
			v7: {
				SR: 0,
				WR: 0,
				opacityIn: [0, 0.1, 0, 1],
				// the Value hasn't decied. (size of canvas height)
				// it will be adjusted by "setSize" method.
				overpaintingIn: [0.3, 0.6, 0, 0],
			},
			m1: {
				opacityIn: [0.2, 0.3, 0, 1],
				opacityOut: [0.4, 0.5, 1, 0],
				translateYIn: [0.2, 0.3, RangeForTransY, 0],
				translateYOut: [0.4, 0.5, 0, -RangeForTransY],
				threshold: 0.35,
			},
		},
	},
];

// get the value for interaction
const getValForElement = (elemArr: Range, currentSceneRatio: number): number => {
	const startRatio = elemArr[0];
	const endRatio = elemArr[1];
	const startValue = elemArr[2];
	const endValue = elemArr[3];
	// because there are many elements in one scene and each element operates independently
	// the elements should only be operated according to the "Raito" which is decided.

	// if the Ratio is out of range, nothing happen -> min / max Value.
	if (currentSceneRatio < startRatio) {
		return startValue;
	} else if (currentSceneRatio > endRatio) {
		return endValue;
	} else {
		// calculate RV

		// Range of Operation
		const RO = endRatio - startRatio;

		// Relative Ratio
		const RR = currentSceneRatio - startRatio;

		// Range of changes
		const RC = endValue - startValue;

		return startValue + (RC * RR) / RO;
	}
};

// apply opacity / translateY of a sticky message
const paintMessage = (elem: HTMLElement, val: MessageValue, ratio: number) => {
	let op: number;
	let transY: number;
	if (ratio < val.threshold) {
		op = getValForElement(val.opacityIn, ratio);
		transY = getValForElement(val.translateYIn, ratio);
	} else {
		op = getValForElement(val.opacityOut, ratio);
		transY = getValForElement(val.translateYOut, ratio);
	}
	const fixedY = elem.offsetHeight / 2;
	elem.style.opacity = `${op}`;
	elem.style.transform = `translate3d(-50%,${-fixedY + transY}px, 0)`;
};

// Img load
const imgLoad = (): HTMLImageElement[][] => {
	// load Img for Video Each
	const imgArr: HTMLImageElement[][] = [];

	// define temporary array to push it into imgArr
	const I_Arr1: HTMLImageElement[] = [];
	const I_Arr2: HTMLImageElement[] = [];

	// load each Imgs
	// scene0 img(287) sam2
	for (let j = 0; j < ImgCount[0]; j++) {
		const img = new Image();
		img.src = Basic_URL + `sam${2}/out${j + 1}.png`;
		img.addEventListener('load', () => {
			I_Arr1[j] = img;
		});
	}
	// push I_Arr in imgArr
	imgArr.push(I_Arr1);

	// scene2 img(374) sam1
	for (let j = 0; j < ImgCount[1]; j++) {
		const img = new Image();
		img.src = Basic_URL + `sam${1}/out${j + 1}.png`;
		img.addEventListener('load', () => {
			I_Arr2[j] = img;
		});
	}
	// push I_Arr in imgArr
	imgArr.push(I_Arr2);

	const v7_Arr: HTMLImageElement[] = [];
	// IMG Load for v7
	for (let i = 0; i < 2; i++) {
		const img = new Image();
		img.src = Basic_URL + `sample${i + 1}.jpeg`;
		img.addEventListener('load', () => {
			v7_Arr[i] = img;
		});
	}
	imgArr[2] = v7_Arr;

	return imgArr;
};

// Must be called after the scene elements are mounted.
// Returns a cleanup function that removes the registered listeners.
export const initScrollAnimation = (): (() => void) => {
	let currentScene = 0;
	const sceneArr = createSceneArr();
	const imgArr = imgLoad();

	const setSize = () => {
		const innerH = window.innerHeight;
		const bodyW = document.body.offsetWidth;
		for (let i = 0; i < sceneArr.length; i++) {
			// Set the height values of each scenes by the value 'heightMultiple'
			sceneArr[i].height = innerH * sceneArr[i].heightMultiple;
			// change the size of element
			sceneArr[i].obj.scene.style.height = `${sceneArr[i].height}px`;
		}

		// Set canvas size
		// canvas should cover the screen
		// Arr -> for doing 'for' loop
		const videoArr: HTMLElement[] = [];
		videoArr.push(sceneArr[0].obj.v1);
		videoArr.push(sceneArr[1].obj.v2);
		videoArr.push(sceneArr[2].obj.v3);
		videoArr.push(sceneArr[2].obj.v4); // videoArr[3]
		videoArr.push(sceneArr[2].obj.v5); // videoArr[4]
		videoArr.push(sceneArr[2].obj.v6);
		videoArr.push(sceneArr[3].obj.v7);
		for (let i = 0; i < videoArr.length; i++) {
			const HR = videoArr[i].offsetHeight / innerH;
			const WR = videoArr[i].offsetWidth / bodyW;
			const SR = HR < WR ? 1 / HR : 1 / WR;
			// set SR
			if (i === 0) sceneArr[0].value.v1.SR = SR;

			if (i === 1) sceneArr[1].value.v2.SR = SR;

			if (i > 1 && i < 6) {
				// v2 ~ v5
				const key = `v${i + 1}` as 'v3' | 'v4' | 'v5' | 'v6';
				sceneArr[2].value[key].SR = SR;
				sceneArr[2].value[key].WR = WR;
			}

			// Scene2 -> adjust the location of videos(v4, v5)
			if (i === 3) {
				videoArr[i].style.transform = `scale(${SR}) translate3d(-${
					(1 / SR) * 50
				}%, ${(1 / SR) * 300}%, 0)`;
			} else if (i === 4) {
				videoArr[i].style.transform = `scale(${SR}) translate3d(-${
					(1 / SR) * 50
				}%, -${(1 / SR) * 300}%, 0)`;
			} else {
				videoArr[i].style.transform = `scale(${SR}) translate3d(-${
					(1 / SR) * 50
				}%, -${(1 / SR) * 50}%, 0)`;
			}
		}

		sceneArr[2].value.v4.fixedWidth =
			sceneArr[2].obj.v4.offsetWidth * sceneArr[2].value.v4.WR;
		sceneArr[2].value.v5.fixedWidth =
			sceneArr[2].obj.v5.offsetWidth * sceneArr[2].value.v5.WR;

		// determine v7(canvas) height size
		sceneArr[3].value.v7.overpaintingIn[2] = sceneArr[3].obj.v7.height;
	};

	const getCurrentSceneScrollY = () => {
		// Current Scene Check ->  use currentScene
		// calculate prev-scene height by using 'currentScene' value
		let prevHeight = 0;
		for (let i = 0; i < currentScene; i++) {
			prevHeight += sceneArr[i].height;
		}
		return scrollY - prevHeight;
	};

	const getCurrentScene = () => {
		let sceneVal = 0;
		let sceneHeightVal = 0;
		for (let i = 0; i < sceneArr.length; i++) {
			sceneHeightVal += sceneArr[i].height;
			if (sceneHeightVal < scrollY) sceneVal++;
		}
		return sceneVal;
	};

	// For painting messages
	const getCurrentSceneRatio = () => {
		// check Current scene -> use currentScene
		// get height of currentScene
		const currentSceneHeight = sceneArr[currentScene].height;

		// get scrollY VAL of current scene
		const currentSceneScrollY = getCurrentSceneScrollY();

		// calculate the Ratio to return
		const currentSceneRatio = currentSceneScrollY / currentSceneHeight;

		return currentSceneRatio;
	};

	// Main Methods

	const sceneCheck = () => {
		// check Current Scene
		currentScene = getCurrentScene();
		// set Attr of "body"
		document.body.setAttribute('id', `show-scene${currentScene}`);
	};

	// ** Play Animation !important
	const playAnimaiton = (ratio: number) => {
		if (ratio > 1) return;

		// declare variables for playing animaiton
		let op = 0;

		switch (currentScene) {
			case 0: {
				// SCENE 0
				const CVal = sceneArr[0].value;
				const CObj = sceneArr[0].obj;
				// Img -> 271 // range of Img: 0 ~ 270
				const imgIndex = Math.round(ratio * (ImgCount[currentScene] - 1));
				const can = CObj.v1;
				const cont = can.getContext('2d');
				const img = imgArr[currentScene][imgIndex];
				if (cont && img && imgIndex > 0 && imgIndex < ImgCount[currentScene])
					cont.drawImage(img, 0, 0);

				// Video Opacity
				if (ratio < CVal.v1.threshold) {
					op = getValForElement(CVal.v1.opacityIn, ratio);
				} else {
					op = getValForElement(CVal.v1.opacityOut, ratio);
				}
				CObj.v1.style.opacity = `${op}`;

				// Message 1 ~ 3
				paintMessage(CObj.message1, CVal.m1, ratio);
				paintMessage(CObj.message2, CVal.m2, ratio);
				paintMessage(CObj.message3, CVal.m3, ratio);

				// video element in other scenes shouldn't be seen
				sceneArr[1].obj.v2.style.opacity = '0';
				sceneArr[2].obj.v3.style.opacity = '0';
				sceneArr[2].obj.v4.style.opacity = '0';
				sceneArr[2].obj.v5.style.opacity = '0';
				sceneArr[3].obj.v7.style.opacity = '0';
				break;
			}
			case 1: {
				// Scene 1
				const CVal = sceneArr[1].value;
				const CObj = sceneArr[1].obj;
				// Video Elem
				if (ratio < CVal.v2.threshold) {
					op = getValForElement(CVal.v2.opacityIn, ratio);
				} else {
					op = getValForElement(CVal.v2.opacityOut, ratio);
				}
				CObj.v2.style.opacity = `${op}`;

				// Message 1 ~ 5
				paintMessage(CObj.message1, CVal.m1, ratio);
				paintMessage(CObj.message2, CVal.m2, ratio);
				paintMessage(CObj.message3, CVal.m3, ratio);
				paintMessage(CObj.message4, CVal.m4, ratio);
				paintMessage(CObj.message5, CVal.m5, ratio);

				// videos in other scenes shouldn't be seen
				sceneArr[0].obj.v1.style.opacity = '0';
				sceneArr[2].obj.v4.style.opacity = '0';
				sceneArr[2].obj.v5.style.opacity = '0';
				sceneArr[3].obj.v7.style.opacity = '0';
				break;
			}
			case 2: {
				// Scene 2
				const CVal = sceneArr[2].value;
				const CObj = sceneArr[2].obj;
				// V3
				if (ratio < CVal.v3.threshold) {
					op = getValForElement(CVal.v3.opacityIn, ratio);
				} else {
					op = getValForElement(CVal.v3.opacityOut, ratio);
				}
				CObj.v3.style.opacity = `${op}`;

				// V4 - Video Out
				if (ratio < CVal.v4.threshold[0] || ratio > CVal.v4.threshold[1]) {
					CObj.v4.style.transform = `scale(${CVal.v4.SR}) translate3d(-${
						(1 / CVal.v4.SR) * 50
					}%, ${(1 / CVal.v4.SR) * 300}%, 0) rotate(90deg)`;
				} else {
					CObj.v4.style.transform = `scale(${CVal.v4.SR}) translate3d(-${
						(1 / CVal.v4.SR) * 50
					}%, -${(1 / CVal.v4.SR) * 50}%, 0) rotate(0deg)`;
				}

				// V5 - Video Out
				if (ratio < CVal.v5.threshold[0] || ratio > CVal.v5.threshold[1]) {
					CObj.v5.style.transform = `scale(${CVal.v5.SR}) translate3d(-${
						(1 / CVal.v5.SR) * 50
					}%, -${(1 / CVal.v5.SR) * 300}%, 0) rotate(90deg)`;
				} else {
					CObj.v5.style.transform = `scale(${CVal.v5.SR}) translate3d(-${
						(1 / CVal.v5.SR) * 50
					}%, -${(1 / CVal.v5.SR) * 50}%, 0) rotate(0deg)`;
				}
				CObj.v4.style.opacity = '1';
				CObj.v5.style.opacity = '1';
				// V6 -> opacity
				if (ratio < CVal.v6.threshold) {
					op = getValForElement(CVal.v6.opacityIn, ratio);
				} else {
					op = getValForElement(CVal.v6.opacityOut, ratio);
				}
				CObj.v6.style.opacity = `${op}`;
				// Location of Message

				for (let i = 0; i < 15; i++) {
					paintMessage(CObj[`message${i + 1}`], CVal[`m${i + 1}`], ratio);
				}

				// V6 -> canvas draw
				const imgIndex2 = Math.round(getValForElement(CVal.v6.videoIndex, ratio));
				const can2 = CObj.v6;
				const cont2 = can2.getContext('2d');
				const img2 = imgArr[1][imgIndex2];
				if (cont2 && img2) cont2.drawImage(img2, 0, 0);

				// videos in other scenes shouldn't be seen
				sceneArr[0].obj.v1.style.opacity = '0';
				sceneArr[1].obj.v2.style.opacity = '0';
				sceneArr[3].obj.v7.style.opacity = '0';
				break;
			}
			case 3: {
				// Scene 3
				const CVal = sceneArr[3].value;
				const CObj = sceneArr[3].obj;
				const can3 = CObj.v7;
				const con3 = can3.getContext('2d');

				// overYIndex = canvas height size ~ 0
				const v7Height = CObj.v7.height;
				const v7Width = CObj.v7.width;
				const overYIndex = getValForElement(CVal.v7.overpaintingIn, ratio);

				const [baseImg, overImg] = imgArr[2];
				if (con3 && baseImg && overImg) {
					con3.drawImage(baseImg, 0, 0);
					// drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
					con3.drawImage(
						overImg,
						0,
						overYIndex,
						v7Width,
						v7Height - overYIndex,
						0,
						overYIndex,
						v7Width,
						v7Height - overYIndex
					);
				}

				op = getValForElement(CVal.v7.opacityIn, ratio);
				CObj.v7.style.opacity = `${op}`;

				// message 1
				paintMessage(CObj.m1, CVal.m1, ratio);

				// videos in other scenes shouldn't be seen
				sceneArr[0].obj.v1.style.opacity = '0';
				sceneArr[1].obj.v2.style.opacity = '0';
				sceneArr[2].obj.v3.style.opacity = '0';
				sceneArr[2].obj.v4.style.opacity = '0';
				sceneArr[2].obj.v5.style.opacity = '0';
				sceneArr[2].obj.v6.style.opacity = '0';
				break;
			}
			default:
				break;
		}
	};

	// OnWindowScroll
	const onWindowScroll = () => {
		const currentSceneRatio = getCurrentSceneRatio();
		sceneCheck();
		playAnimaiton(currentSceneRatio);
	};

	const onResize = () => {
		window.location.reload();
	};

	const onOrientationChange = () => {
		scrollTo(0, 0);
		location.reload();
	};

	const onLoad = () => {
		document.body.classList.remove('before-loaded');
		setTimeout(() => {
			scrollTo(0, 0);
		}, 100);

		sceneCheck();
		setSize();
	};

	// if previous 'Scrolling value' is not (0, 0) it's possible that the Error is happening.
	// so we have to use the 'Closer' trigger.

	document.body.classList.add('before-loaded');

	window.addEventListener('resize', onResize);
	window.addEventListener('orientationchange', onOrientationChange);
	// the component may mount after the 'load' event has already fired
	if (document.readyState === 'complete') {
		onLoad();
	} else {
		window.addEventListener('load', onLoad);
	}
	window.addEventListener('scroll', onWindowScroll);

	return () => {
		window.removeEventListener('resize', onResize);
		window.removeEventListener('orientationchange', onOrientationChange);
		window.removeEventListener('load', onLoad);
		window.removeEventListener('scroll', onWindowScroll);
	};
};
