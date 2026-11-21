/* eslint-disable react-hooks/exhaustive-deps */
import React from "react";
// import { useCrashContext } from "../Main/context";
import "./crash.scss";
import Unity from "react-unity-webgl";
import Context from "../../context";
import { getSimulatedPlayerCount } from "../../utils/simulated-activity";

export default function WebGLStarter() {
	const {
		GameState,
		currentNum,
		time,
		serverTime,
		multiplierRate,
		durationMs,
		roundId,
		unityState,
		myUnityContext,
		setCurrentTarget,
	} = React.useContext(Context)
	const [target, setTarget] = React.useState(1);
	const [flag, setFlag] = React.useState(1);
	const [clockNow, setClockNow] = React.useState(Date.now());
	const [introVisible, setIntroVisible] = React.useState(false);
	const [introLeaving, setIntroLeaving] = React.useState(false);
	const serverClockOffsetRef = React.useRef(0);
	const remainingMs = Math.max(
		0,
		Number(durationMs || 0) - (clockNow + serverClockOffsetRef.current - Number(time || 0))
	);
	const simulatedPlayerCount = getSimulatedPlayerCount(Number(roundId) || 1000);

	React.useEffect(() => {
		if (GameState === "FLYING") {
			setIntroVisible(true);
			setIntroLeaving(false);
			const fadeTimeout = window.setTimeout(() => setIntroLeaving(true), 1250);
			const hideTimeout = window.setTimeout(() => {
				setIntroVisible(false);
				setIntroLeaving(false);
			}, 1800);
			return () => {
				window.clearTimeout(fadeTimeout);
				window.clearTimeout(hideTimeout);
			};
		}
		setIntroVisible(false);
		setIntroLeaving(false);
	}, [GameState, roundId]);

	React.useEffect(() => {
		const serverTimestamp = Number(serverTime);
		if (Number.isFinite(serverTimestamp) && serverTimestamp > 0) {
			serverClockOffsetRef.current = serverTimestamp - Date.now();
		}
	}, [time]);

	React.useEffect(() => {
		if (GameState === "FLYING") {
			setFlag(2);
			const serverMultiplier = Number(currentNum);
			if (Number.isFinite(serverMultiplier) && serverMultiplier > 0) {
				setTarget(serverMultiplier);
				setCurrentTarget(serverMultiplier);
				if (serverMultiplier > 10) setFlag(4);
				else if (serverMultiplier > 2) setFlag(3);
			}
		} else if (GameState === "CRASHED") {
			setFlag(5);
			setCurrentTarget(Number(currentNum));
			setTarget(Number(currentNum));
		} else {
			setFlag(1);
			setTarget(1);
			setCurrentTarget(1);
		}
	}, [GameState, currentNum, setCurrentTarget])

	React.useEffect(() => {
		myUnityContext?.send("GameManager", "RequestToken", JSON.stringify({
			gameState: flag
		}));
	}, [flag, myUnityContext]);

	React.useEffect(() => {
		if (!["COUNTDOWN", "WAITING", "NEXT ROUND"].includes(GameState)) return;
		const updateClock = () => setClockNow(Date.now());
		updateClock();
		const interval = setInterval(updateClock, 100);
		return () => clearInterval(interval);
	}, [GameState, time]);

	const spaceRef = React.useRef<HTMLDivElement>(null);
	const flightSvgRef = React.useRef<SVGSVGElement>(null);
	const flightTrailRef = React.useRef<SVGPathElement>(null);
	const flightAreaRef = React.useRef<SVGPathElement>(null);
	const flightPlaneRef = React.useRef<SVGSVGElement>(null);
	const multiplierValueRef = React.useRef<HTMLElement>(null);

	// Create stars
	React.useEffect(() => {
		if (spaceRef.current) {
			// Clear existing stars
			const existingStars = spaceRef.current.querySelectorAll('.star');
			existingStars.forEach(star => star.remove());

			// Create new stars
			for (let i = 0; i < 35; i++) {
				const star = document.createElement('div');
				star.classList.add('star');
				const size = Math.random() * 2 + 0.5;
				star.style.width = `${size}px`;
				star.style.height = `${size}px`;
				star.style.left = `${Math.random() * 100}%`;
				star.style.bottom = `-${size}px`;
				const delay = Math.random() * 7;
				const duration = Math.random() * 5 + 3.5;
				star.style.animation = `zoomOut ${duration}s linear ${delay}s infinite`;
				spaceRef.current.appendChild(star);
			}
		}
	}, []);

	// Draw the flight path and place the plane at its endpoint in the same frame.
	React.useEffect(() => {
		if (GameState !== "FLYING" && GameState !== "CRASHED") return;

		const start = { x: 120, y: 360 };
		const control1 = { x: 230, y: 360 };
		const control2 = { x: 280, y: 220 };
		const end = { x: 880, y: 155 };
		const roundStartedAt = Number(time);
		const rate = Number(multiplierRate) > 0 ? Number(multiplierRate) : 0.22;
		if (!Number.isFinite(roundStartedAt) || roundStartedAt <= 0 || !Number.isFinite(rate) || rate <= 0) return;
		let frame = 0;

		const lerp = (from: number, to: number, amount: number) =>
			from + (to - from) * amount;
		const mixPoint = (
			from: { x: number; y: number },
			to: { x: number; y: number },
			amount: number
		) => ({
			x: lerp(from.x, to.x, amount),
			y: lerp(from.y, to.y, amount),
		});
		const animate = () => {
			const elapsedSeconds = GameState === "CRASHED"
				? Math.max(0, (Number(currentNum) - 1) / rate)
				: Math.max(
					0,
					(Date.now() + serverClockOffsetRef.current - roundStartedAt) / 1000
				);
			const progress = 0.94 * (1 - Math.exp(-elapsedSeconds / 18));
			const liveMultiplier = GameState === "CRASHED"
				? Number(currentNum)
				: 1 + elapsedSeconds * rate;
			const firstControl = mixPoint(start, control1, progress);
			const middleControl = mixPoint(control1, control2, progress);
			const lastControl = mixPoint(control2, end, progress);
			const secondControl = mixPoint(firstControl, middleControl, progress);
			const thirdControl = mixPoint(middleControl, lastControl, progress);
			const endpoint = mixPoint(secondControl, thirdControl, progress);
			const path = `M ${start.x} ${start.y} C ${firstControl.x} ${firstControl.y} ${secondControl.x} ${secondControl.y} ${endpoint.x} ${endpoint.y}`;
			const tangentX = 3 * (1 - progress) ** 2 * (control1.x - start.x)
				+ 6 * (1 - progress) * progress * (control2.x - control1.x)
				+ 3 * progress ** 2 * (end.x - control2.x);
			const tangentY = 3 * (1 - progress) ** 2 * (control1.y - start.y)
				+ 6 * (1 - progress) * progress * (control2.y - control1.y)
				+ 3 * progress ** 2 * (end.y - control2.y);

			flightTrailRef.current?.setAttribute(
				"d",
				`M ${start.x} ${start.y} C ${firstControl.x} ${firstControl.y} ${secondControl.x} ${secondControl.y} ${endpoint.x} ${endpoint.y}`
			);
			flightAreaRef.current?.setAttribute(
				"d",
				`${path} L ${endpoint.x} 500 L 0 500 Z`
			);
			const svgBounds = flightSvgRef.current?.getBoundingClientRect();
			if (svgBounds && flightPlaneRef.current) {
				const screenX = endpoint.x * svgBounds.width / 1000;
				const screenY = endpoint.y * svgBounds.height / 500;
				const screenTangentX = tangentX * svgBounds.width / 1000;
				const screenTangentY = tangentY * svgBounds.height / 500;
				const rotation = Math.atan2(screenTangentY, screenTangentX) * 180 / Math.PI;
				flightPlaneRef.current.style.left = `${screenX}px`;
				flightPlaneRef.current.style.top = `${screenY}px`;
				flightPlaneRef.current.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
			}
			if (multiplierValueRef.current) {
				multiplierValueRef.current.textContent = `${liveMultiplier.toFixed(2)}x`;
			}
			if (GameState === "FLYING") frame = requestAnimationFrame(animate);
		};

		frame = requestAnimationFrame(animate);
		return () => cancelAnimationFrame(frame);
	}, [GameState, time, multiplierRate]);
	const displayedMultiplier = Math.max(1, Number(target) || Number(currentNum) || 1);
	const countdownSeconds = Math.ceil(remainingMs / 1000);

	return (
		<div className="crash-container">
			<div className="space-box" ref={spaceRef} id="space">
				{unityState && (
					<Unity unityContext={myUnityContext} matchWebGLToCanvasSize={true} style={{ position: 'absolute', width: '100%', height: '100%', zIndex: 1 }} />
				)}
				{(GameState === "FLYING" || GameState === "CRASHED") && (
					<>
						<svg ref={flightSvgRef} className="crash-curve" viewBox="0 0 1000 500" preserveAspectRatio="none" aria-label="Plane in flight">
							<defs>
								<linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
									<stop offset="0%" stopColor="#ff1749" stopOpacity="0.95" />
									<stop offset="100%" stopColor="#ff1749" stopOpacity="0.08" />
								</linearGradient>
							</defs>
							<path ref={flightAreaRef} fill="url(#curveFill)" />
							<path ref={flightTrailRef} fill="none" stroke="#ff315f" strokeWidth="6" strokeLinecap="round" />
						</svg>
						<svg
							ref={flightPlaneRef}
							className={`aircraft-figure ${GameState === "CRASHED" ? "is-crashed" : ""}`}
							viewBox="0 0 220 120"
							role="img"
							aria-label="Red aircraft"
						>
							<defs>
								<linearGradient id="aircraftRed" x1="0" y1="0" x2=".2" y2="1">
									<stop offset="0%" stopColor="#ff8b9f" />
									<stop offset="42%" stopColor="#ff344f" />
									<stop offset="100%" stopColor="#a90025" />
								</linearGradient>
								<linearGradient id="aircraftWing" x1="0" y1="0" x2=".3" y2="1">
									<stop offset="0%" stopColor="#ff6479" />
									<stop offset="100%" stopColor="#d60c36" />
								</linearGradient>
								<filter id="aircraftGlow" x="-50%" y="-80%" width="200%" height="260%">
									<feGaussianBlur stdDeviation="6" />
								</filter>
							</defs>
							<ellipse cx="108" cy="62" rx="82" ry="17" fill="#ff416b" opacity=".3" filter="url(#aircraftGlow)" />
							<g className="aircraft-silhouette" stroke="#ffb5c1" strokeLinejoin="round">
								<path d="M14 66 Q53 58 101 52 L171 45 Q188 44 198 52 L204 58 L198 64 Q185 69 168 69 L116 69 Q77 76 37 92 L25 89 L49 72 L18 74 Q11 73 14 66 Z" fill="url(#aircraftRed)" strokeWidth="1.5" />
								<path d="M91 59 L55 28 Q50 21 59 20 L135 49 L162 46 L188 38 Q196 37 193 44 L164 60 L112 70 Z" fill="url(#aircraftWing)" strokeWidth="1.5" />
								<path d="M57 67 L38 43 Q34 37 41 37 L80 60 L105 63 L80 72 Z" fill="url(#aircraftWing)" strokeWidth="1.5" />
								<path d="M48 72 L20 56 Q14 53 13 59 L31 77 Z" fill="url(#aircraftRed)" strokeWidth="1.5" />
							</g>
							<path d="M73 65 L175 54" fill="none" stroke="#ffe2e7" strokeWidth="2" opacity=".9" />
							<path d="M77 69 L119 55" fill="none" stroke="#ffadb9" strokeWidth="1.5" opacity=".85" />
							<path d="M151 52 L183 47" fill="none" stroke="#ffd0d8" strokeWidth="2" opacity=".9" />
							<path d="M127 57 l6 -1 m5 -1 6 -1 m5 -1 6 -1" stroke="#fff1f3" strokeWidth="3" strokeLinecap="round" />
							<path d="M169 50 Q179 47 188 49 L180 56 L168 57 Z" fill="#b9e8ff" stroke="#fff" strokeWidth="1" />
							<g className="aircraft-propeller">
								<path d="M201 44 Q207 57 202 70" fill="none" stroke="#ffe2e7" strokeWidth="4" strokeLinecap="round" />
								<path d="M196 56 L208 58" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
							</g>
							<circle cx="200" cy="57" r="3.5" fill="#fff" />
						</svg>
						{!introVisible && <div
							className="players-playing simulated-players-playing"
							aria-label={`${simulatedPlayerCount} simulated players; demo sample activity excluded from player and wager totals`}
						>
							<span className="players-live-dot" aria-hidden="true" />
							<strong>{simulatedPlayerCount} SIM PLAYERS</strong>
							<small>demo activity</small>
						</div>}
					</>
				)}
				{GameState === "COUNTDOWN" && (
					<div
						className="round-countdown"
						aria-label={`Next round starts in ${countdownSeconds} seconds`}
					>
						{countdownSeconds}s
					</div>
				)}
				{introVisible && (
					<section
						className={`pre-round-intro ${introLeaving ? "is-leaving" : ""}`}
						aria-label="Aviator round introduction"
					>
						<div className="pre-round-brand">
							<svg className="pre-round-plane" viewBox="0 0 120 64" aria-hidden="true">
								<path d="M4 35 46 27 72 8q8-6 18-5L80 25l35 9q5 1 1 5l-41-2-29 17q-7 3-14 1l14-17-35 3q-8 0-7-6Z" fill="url(#introPlaneRed)" />
								<defs>
									<linearGradient id="introPlaneRed" x1="0" y1="0" x2="1" y2="1">
										<stop offset="0%" stopColor="#ff7693" />
										<stop offset="100%" stopColor="#c80036" />
									</linearGradient>
								</defs>
							</svg>
							<div>
								<strong>AVIATOR</strong>
								<span>FLIGHT GAME</span>
							</div>
						</div>
						<div className="pre-round-round-heading">ROUND STATUS</div>
						<div className="pre-round-round-card">
							<span className="pre-round-round-icon" aria-hidden="true">✦</span>
							<div className="pre-round-round-copy">
								<strong>LIVE FLIGHT ✓</strong>
								<span>ROUND {roundId || "—"}</span>
							</div>
						</div>
						<div className="pre-round-countdown">
							<span>FLIGHT BEGINS</span>
							<strong>✦</strong>
						</div>
						<div
							className="pre-round-progress"
							aria-hidden="true"
						>
							<span />
						</div>
						<small className="pre-round-credit-note">VIRTUAL CREDITS · NO REAL PAYMENTS</small>
					</section>
				)}
				{GameState === "WAITING" && <div className="game-phase-message">WAITING FOR NEXT ROUND</div>}
				{GameState === "NEXT ROUND" && <div className="game-phase-message">NEXT ROUND STARTING</div>}
				{(GameState === "FLYING" || GameState === "CRASHED") && (
					<div className={`multiplier show ${GameState === "CRASHED" ? "crashed" : ""}`}>
						{GameState === "CRASHED" && <span className="crash-result-label">CRASHED AT</span>}
						<strong ref={multiplierValueRef}>{displayedMultiplier.toFixed(2)}x</strong>
					</div>
				)}
			</div>
		</div>
	);
};

