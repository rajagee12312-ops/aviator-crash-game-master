import React, { useEffect } from "react";
// import { useCrashContext } from "../context";
import { toast } from 'react-toastify';
import Context, { callCashOut } from "../../context";
import { formatPKR } from "../../utils/currency";

interface BetProps {
	index: 'f' | 's'
	add: boolean
	setAdd: any
}
type FieldNameType = 'betAmount' | 'decrease' | 'increase' | 'singleAmount'
type BetOptType = '100' | '200' | '500' | '1000'
type GameType = 'manual' | 'auto'

const Bet = ({ index, add, setAdd }: BetProps) => {
	const context = React.useContext(Context)
	const { state,
		fbetted, sbetted,
		fbetState, sbetState,
		GameState,
		currentNum,
		currentSecondNum,
		minBet, maxBet,
		currentTarget,
		update,
		updateUserBetState
	} = context;
	const [cashOut, setCashOut] = React.useState(state.userInfo[index].target || 2);

	const auto = index === 'f' ? state.userInfo.f.auto : state.userInfo.s.auto
	const betted = index === 'f' ? fbetted : sbetted
	const deState = index === 'f' ? state.fdeState : state.sdeState
	const inState = index === 'f' ? state.finState : state.sinState
	const betState = index === 'f' ? fbetState : sbetState
	const decrease = index === 'f' ? state.fdecrease : state.sdecrease
	const increase = index === 'f' ? state.fincrease : state.sincrease
	const autoCound = index === 'f' ? state.fautoCound : state.sautoCound
	const betAmount = index === 'f' ? state.userInfo.f.betAmount : state.userInfo.s.betAmount
	const autoCashoutState = index === 'f' ? state.fautoCashoutState : state.sautoCashoutState
	const cashouted = state.userInfo[index].cashouted
	const autoTarget = state.userInfo[index].target
	const single = index === 'f' ? state.fsingle : state.ssingle
	const singleAmount = index === 'f' ? state.fsingleAmount : state.ssingleAmount
	const liveMultiplier = Math.max(1, Number(currentNum) || 1)

	const [gameType, setGameType] = React.useState<GameType>("manual");
	const [betOpt, setBetOpt] = React.useState<BetOptType>("100");
	const [showModal, setShowModal] = React.useState(false);
	const [myBetAmount, setMyBetAmount] = React.useState(20);
	const autoCashoutRequested = React.useRef(false);
	// const { index } = props;

	const setBetAmount = (value: number) => {
		const maximum = Math.min(maxBet, state.userInfo.balance);
		const normalized = Math.min(maximum, Math.max(minBet, Number(value) || minBet));
		update({
			userInfo: {
				...state.userInfo,
				[index]: { ...state.userInfo[index], betAmount: Number(normalized.toFixed(2)) },
			},
		});
	};

	const minus = (type: FieldNameType) => {
		if (type === "betAmount") {
			setBetAmount(betAmount - 1);
			return;
		}
		let value = state;
		if (value[`${index + type}`] - 0.1 < 0.1) {
			value[`${index + type}`] = 0.1
		} else {
			value[`${index + type}`] = Number((Number(value[`${index + type}`]) - 0.1).toFixed(2))
		}
		update(value);
	}

	const plus = (type: FieldNameType) => {
		if (type === "betAmount") {
			setBetAmount(betAmount + 1);
			return;
		}
		let value = state;
		if (value[`${index + type}`] + 0.1 > state.userInfo.balance) {
			value[`${index + type}`] = Math.round(state.userInfo.balance * 100) / 100
		} else {
			value[`${index + type}`] = Number((Number(value[`${index + type}`]) + 0.1).toFixed(2))
		}
		update(value);
	}

	const manualPlus = (amount: number, btnNum: BetOptType) => {
		setBetAmount(amount);
		setBetOpt(btnNum);
	}

	const changeBetType = (e: GameType) => {
		updateUserBetState({ [`${index}betState`]: false });
		setGameType(e);
	}

	const onChangeBlur = (e: number, type: 'cashOutAt' | 'decrease' | 'increase' | 'singleAmount') => {
		let value = state;
		if (type === "cashOutAt") {
			const target = Math.min(25, Math.max(1.01, Math.round(e * 100) / 100));
			setCashOut(target);
			update({
				userInfo: {
					...state.userInfo,
					[index]: { ...state.userInfo[index], target },
				},
			});
			return;
		} else {
			if (e < 0.1) {
				value[`${index + type}`] = 0.1;
			} else {
				value[`${index + type}`] = Math.round(e * 100) / 100;
			}
		}
		update(value);
	}

	const onBetClick = (s: boolean) => {
		updateUserBetState({ [`${index}betState`]: s })
	}
	const setAutoCashout = (enabled: boolean) => {
		update({
			[`${index}autoCashoutState`]: enabled,
			userInfo: {
				...state.userInfo,
				[index]: { ...state.userInfo[index], autocashout: enabled },
			},
		});
	}
	const setCount = (amount: number) => {
		let attrs = state;
		attrs[`${index}autoCound`] = amount;
		update(attrs);
	}

	const reset = () => {
		update({
			[`${index}autoCound`]: 0,
			[`${index}decrease`]: 0,
			[`${index}increase`]: 0,
			[`${index}singleAmount`]: 0,
			[`${index}deState`]: false,
			[`${index}inState`]: false,
			[`${index}single`]: false,
		})
	}

	const onAutoBetClick = (_betState: boolean) => {
		update({
			userInfo: {
				...state.userInfo,
				[index]: { ...state.userInfo[index], auto: _betState },
			},
		});

		updateUserBetState({ [`${index}betState`]: _betState });
	}

	const onStartBtnClick = () => {
		if (autoCound <= 0) {
			toast.error("Please, set number of rounds");
			return;
		}
		onAutoBetClick(true);
		setShowModal(false);
	}
	useEffect(() => {
		if (!betted) {
			autoCashoutRequested.current = false;
			return;
		}
		if (
			GameState === "FLYING"
			&& autoCashoutState
			&& Number(autoTarget) <= currentSecondNum
			&& !autoCashoutRequested.current
		) {
			autoCashoutRequested.current = true;
			callCashOut(currentTarget, index);
		}
	}, [autoCashoutState, autoTarget, betted, currentSecondNum, currentTarget, GameState, index])

	useEffect(() => {
		setMyBetAmount(betAmount);
	}, [betAmount])
	useEffect(() => {
		setCashOut(state.userInfo[index].target);
	}, [index, state.userInfo, autoTarget])

	return (
		<div className="bet-control">
			<div className="controls">
				{index === 'f' ? !add && (
					<div className="sec-hand-btn add" onClick={() => setAdd(true)}></div>
				) : add &&
				<div className="sec-hand-btn minus" onClick={() => setAdd(false)}></div>
				}
				<div className="navigation">
					<div className="navigation-switcher">
						{(betted || betState) ?
							<>
								<button className={gameType === "manual" ? "active" : ""} >Bet</button>
								<button className={gameType === "auto" ? "active" : ""} >Auto</button>
							</> :
							<>
								<button className={gameType === "manual" ? "active" : ""} onClick={() => changeBetType("manual")}>Bet</button>
								<button className={gameType === "auto" ? "active" : ""} onClick={() => changeBetType("auto")}>Auto</button>
							</>
						}
					</div>
				</div>
				<div className="first-row">
					<div className="bet-block">
						<div className="bet-spinner">
							<div className={`spinner ${betState || betted ? "disabled" : ""}`}>
								<div className="buttons">
									<button className="minus" onClick={() => betState || betted ? "" : minus("betAmount")}></button>
								</div>
								<div className="input">
									{betState || betted ?
										<input aria-label="Bet amount" max={Math.min(maxBet, state.userInfo.balance)} min={minBet} step="0.01" type="number" value={Number(myBetAmount)} readOnly />
										:
										<input
											aria-label="Bet amount"
											max={Math.min(maxBet, state.userInfo.balance)}
											min={minBet}
											onChange={(event) => setBetAmount(Number(event.target.value))}
											step="0.01"
											type="number"
											value={Number(myBetAmount)}
										/>
									}
								</div>
								<div className="buttons">
									<button className="plus" onClick={() => betState || betted ? "" : plus("betAmount")}></button>
								</div>
							</div>
						</div>
						{betState || betted ?
							<div className="bet-opt-list">
								<button className="bet-opt disabled">
									<span>100</span>
								</button>
								<button className="bet-opt disabled">
									<span>200</span>
								</button>
								<button className="bet-opt disabled">
									<span>500</span>
								</button>
								<button className="bet-opt disabled">
									<span>1K</span>
								</button>
							</div>
							:
							<div className="bet-opt-list">
								<button onClick={() => manualPlus(100, "100")} className={`bet-opt ${betOpt === "100" && Number(betAmount) === 100 ? "selected" : ""}`} type="button">
									<span>100</span>
								</button>
								<button onClick={() => manualPlus(200, "200")} className={`bet-opt ${betOpt === "200" && Number(betAmount) === 200 ? "selected" : ""}`} type="button">
									<span>200</span>
								</button>
								<button onClick={() => manualPlus(500, "500")} className={`bet-opt ${betOpt === "500" && Number(betAmount) === 500 ? "selected" : ""}`} type="button">
									<span>500</span>
								</button>
								<button onClick={() => manualPlus(1000, "1000")} className={`bet-opt ${betOpt === "1000" && Number(betAmount) === 1000 ? "selected" : ""}`} type="button">
									<span>1K</span>
								</button>
							</div>
						}
					</div>
					<div className="buttons-block">
						{betted ? GameState === "FLYING" && !cashouted ?
							<button className="btn-waiting" onClick={() => { callCashOut(currentTarget, index) }} type="button">
								<span>
									<label>CASHOUT</label>
									<label className="amount">{formatPKR(betAmount * liveMultiplier)}</label>
								</span>
							</button>
							: cashouted
								? <button className="btn-waiting" disabled type="button">CASHED OUT · {formatPKR(state.userInfo[index].cashAmount)}</button>
								: <button className="btn-danger" disabled type="button">WAITING</button> : betState ?
							<>
								<div className="btn-tooltip">Waiting for next round</div>
								<button className="btn-danger h-[70%]" onClick={() => {
									onBetClick(false);
									update({ ...state, [`${index}autoCound`]: 0, userInfo: { ...state.userInfo, [index]: { ...state.userInfo[index], auto: false } } })
								}} type="button"><label>CANCEL</label></button>
							</> :
							GameState === "COUNTDOWN" ? (
								<button onClick={() => onBetClick(true)} className="btn-success" type="button">
									<span>
										<label>BET</label>
										<label className="amount">
											{formatPKR(Number(betAmount))}
										</label>
									</span>
								</button>
							) : (
								<button className="btn-success next-round-btn" disabled type="button">
									<span>
										<label>{GameState === "FLYING" || GameState === "CRASHED" || GameState === "NEXT ROUND" ? "NEXT ROUND" : "WAITING"}</label>
										<label className="amount">{formatPKR(Number(betAmount))}</label>
									</span>
								</button>
							)
						}
					</div>
				</div>
				{/* Auto */}
				{
					gameType === "auto" &&
					<>
						<div className="border-line"></div>
						<div className="second-row">
							<div className="auto-bet-wrapper">
								<div className="auto-bet">
									{auto ? (
										<button onClick={() => onAutoBetClick(false)} className="auto-play-btn btn-danger" >{autoCound}</button>
									) : (
										<button onClick={() => { setShowModal(true); }} className="auto-play-btn btn-primary">AUTO PLAY</button>
									)}
								</div>
							</div>
							<div className="cashout-block">
								<div className="cashout-switcher">
									<label className="label">Auto Cash Out</label>
									{betted || betState ? (
										<div className={`input-switch ${autoCashoutState ? "" : "off"}`}>
											<span className="oval"></span>
										</div>
									) : (
										<div
											aria-label="Toggle automatic cashout"
											className={`input-switch ${autoCashoutState ? "" : "off"}`}
											onClick={() => setAutoCashout(!autoCashoutState)}
											role="switch"
											aria-checked={autoCashoutState}
										>
											<span className="oval"></span>
										</div>
									)}
								</div>
								<div className="cashout-snipper-wrapper">
									<div className="cashout-snipper">
										<div className={`snipper small ${autoCashoutState && !betState ? "" : "disabled"}`}>
											<div className="input">
												{autoCashoutState && !betState ? (
													<input type="number"
														min="1.01"
														max="25"
														step="0.01"
														onChange={(e) => {
															const nextTarget = Number(e.target.value);
															setCashOut(nextTarget);
															update({
																userInfo: {
																	...state.userInfo,
																	[index]: { ...state.userInfo[index], target: nextTarget },
																},
															});
														}}
														value={cashOut}
														onBlur={(e) => onChangeBlur(Number(e.target.value) || 0, "cashOutAt")}
													/>
												) : (
													<input type="number" value={cashOut.toFixed(2)} readOnly />
												)}
											</div>
											<span className="text">x</span>
										</div>
									</div>
								</div>
							</div>
						</div>
					</>
				}
			</div >
			{showModal &&
				<div className="modal">
					<div onClick={() => setShowModal(false)} className="back"></div>
					<div className="modal-dialog">
						<div className="modal-content">
							<div className="modal-header">
								<span>Auto play options</span>
								<button className="close" onClick={() => setShowModal(false)}>
									<span>x</span>
								</button>
							</div>
							<div className="modal-body">
								<div className="content-part content-part-1">
									<span>Number of Rounds:</span>
									<div className="rounds-wrap">
										<button
											className={`btn-secondary ${autoCound === 10 ? "onClick" : ""}`}
											onClick={() => setCount(10)}>
											10</button>
										<button
											className={`btn-secondary ${autoCound === 20 ? "onClick" : ""}`}
											onClick={() => setCount(20)}>
											20</button>
										<button
											className={`btn-secondary ${autoCound === 50 ? "onClick" : ""}`}
											onClick={() => setCount(50)}>
											50</button>
										<button
											className={`btn-secondary ${autoCound === 100 ? "onClick" : ""}`}
											onClick={() => setCount(100)}>
											100</button>
									</div>
								</div>
								<div className="content-part">
									<div className={`input-switch ${deState ? "" : "off"}`}
										onClick={() => {
											update({ [`${index}deState`]: !deState, [`${index}decrease`]: 0 });
										}}
									>
										<span className="oval"></span>
									</div>
									<span className="title">Stop if cash decreases by</span>
									<div className="spinner">
										{deState ?
											<div className="m-spinner">
												<div className="buttons">
													<button onClick={() => minus("decrease")} className="minus"></button>
												</div>
												<div className="input">
													<input type="number" onChange={(e) => update({ [`${index}decrease`]: Number(e.target.value) })} value={decrease}
														onBlur={(e) => onChangeBlur(Number(e.target.value) || 0, "decrease")}
													/>
												</div>
												<div className="buttons">
													<button onClick={() => plus("decrease")} className="plus"></button>
												</div>
											</div> :
											<div className="m-spinner disabled">
												<div className="buttons">
													<button disabled className="minus"></button>
												</div>
												<div className="input">
													<input type="number" readOnly value={Number(decrease).toFixed(2)} />
												</div>
												<div className="buttons">
													<button disabled className="plus"></button>
												</div>
											</div>}
									</div>
									<span >PKR</span>
								</div>
								<div className="content-part">
									<div className={`input-switch ${inState ? "" : "off"}`}
										onClick={() => {
											update({ [`${index}inState`]: !inState, [`${index}increase`]: 0 });
										}}
									>
										<span className="oval"></span>
									</div>
									<span className="title">Stop if cash increases by</span>
									<div className="spinner">
										{inState ? <div className="m-spinner">
											<div className="buttons">
												<button onClick={() => minus("increase")} className="minus"></button>
											</div>
											<div className="input">
												<input type="number" onChange={(e) => update({ [`${index}increase`]: Number(e.target.value) })} value={increase}
													onBlur={(e) => onChangeBlur(Number(e.target.value), "increase")}
												/>
											</div>
											<div className="buttons">
												<button onClick={() => plus("increase")} className="plus"></button>
											</div>
										</div> : <div className="m-spinner disabled">
											<div className="buttons">
												<button disabled className="minus"></button>
											</div>
											<div className="input">
												<input type="number" readOnly value={Number(increase).toFixed(2)} />
											</div>
											<div className="buttons">
												<button disabled className="plus"></button>
											</div>
										</div>}
									</div>
									<span >PKR</span>
								</div>
								<div className="content-part">
									<div className={`input-switch ${single ? "" : "off"}`}
										onClick={() => {
											update({ [`${index}single`]: !single, [`${index}singleAmount`]: 0 });
										}}
									>
										<span className="oval"></span>
									</div>
									<span className="title">Stop if single win exceeds</span>
									<div className="spinner">
										{!!single ?
											<div className="m-spinner">
												<div className="buttons">
													<button onClick={() => minus("singleAmount")} className="minus"></button>
												</div>
												<div className="input">
													<input type="number" onChange={(e) => update({ [`${index}singleAmount`]: Number(e.target.value) })} value={singleAmount}
														onBlur={(e) => onChangeBlur(Number(e.target.value), "singleAmount")}
													/>
												</div>
												<div className="buttons">
													<button onClick={() => plus("singleAmount")} className="plus" ></button>
												</div>
											</div> :
											<div className="m-spinner disabled">
												<div className="buttons ">
													<button disabled className="minus"></button>
												</div>
												<div className="input">

													<input type="number" readOnly value={singleAmount.toFixed(2)} />
												</div>
												<div className="buttons">
													<button disabled className="plus"></button>
												</div>
											</div>
										}
									</div>
									<span >PKR</span>
								</div>
							</div>
							<div className="modal-footer">
								<div className="btns-wrapper">
									<button className="reset-btn btn-waiting" onClick={reset}>Reset</button>
									<button className="start-btn btn-success" onClick={onStartBtnClick}>Start</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			}
		</div >
	)
}

export default Bet