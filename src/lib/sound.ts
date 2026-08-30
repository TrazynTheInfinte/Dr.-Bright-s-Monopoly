// Two kinds of sound in here: short procedural sound effects, synthesized
// at runtime with the Web Audio API (oscillator/noise bursts, deliberately
// simple/8-bit sounding rather than realistic), and real supplied audio
// files for anything longer - background music, ambience loops, and the
// one real-file sound effect stinger (see playEnterRageStinger).

const MUTE_STORAGE_KEY = 'comunopoly-muted';
const MUSIC_VOLUME_STORAGE_KEY = 'comunopoly-music-volume';
// The gain/volume actually applied is this, scaled by the user's music
// volume preference (0-1) - these are the "100%" ceilings, tuned so
// music sits behind the sound effects rather than over them.
const MAX_GAME_MUSIC_VOLUME = 0.7;
// Ambience layers underneath whatever music is playing (menu ambience
// under nothing, in-game ambience under the shuffling tracks) - quieter
// than the music itself so it reads as atmosphere, not a second song.
const MAX_AMBIENCE_VOLUME = 0.18;
// SCP-939's personal early-warning loop (see setVoicesWarning) - louder
// than ambience, since this one is meant to actually be noticed by the
// one player it's for, but still under the music/ambience on top of it.
const MAX_VOICES_WARNING_VOLUME = 0.3;

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
}

let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let muted = localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
let musicVolume = clamp01(Number(localStorage.getItem(MUSIC_VOLUME_STORAGE_KEY) ?? '1'));

export function getMusicVolume(): number {
  return musicVolume;
}

/** A 0-1 preference, independent of the mute toggle - applies to the real in-game music tracks and the ambience layer alike. */
export function setMusicVolume(value: number): void {
  musicVolume = clamp01(value);
  localStorage.setItem(MUSIC_VOLUME_STORAGE_KEY, String(musicVolume));
  // Only the active element, not whichever's mid-fade-out on its way to
  // silence - touching that one would undo the fade.
  const el = activeGameMusicEl();
  if (el && !muted) el.volume = MAX_GAME_MUSIC_VOLUME * musicVolume;
  const ambEl = activeAmbienceEl();
  if (ambEl && !muted) ambEl.volume = MAX_AMBIENCE_VOLUME * musicVolume;
  if (voicesWarningEl && voicesWarningIntensity > 0 && !muted) {
    voicesWarningEl.volume = MAX_VOICES_WARNING_VOLUME * musicVolume * voicesWarningIntensity;
  }
}

function ensureContext(): AudioContext | null {
  // Some environments (very old browsers, or this code running before
  // any DOM exists) might not have Web Audio at all - fail quiet rather
  // than throw, since sound is a nice-to-have, never load-bearing.
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  if (!audioContext) {
    audioContext = new Ctor();
    masterGain = audioContext.createGain();
    masterGain.gain.value = muted ? 0 : 1;
    masterGain.connect(audioContext.destination);

    sfxGain = audioContext.createGain();
    sfxGain.gain.value = 0.5;
    sfxGain.connect(masterGain);
  }
  return audioContext;
}

/** Must be called from within a real user gesture (a click) - browsers refuse to start/resume audio otherwise. Safe to call repeatedly. */
export function initAudio(): void {
  const ctx = ensureContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {
      // Autoplay was refused (no user gesture yet, or the browser just
      // said no) - harmless, the next real click will retry.
    });
  }
}

/** Wires a one-time "first click anywhere" listener that unlocks audio and starts the menu ambience (if not muted) - so sound works even if the player never touches the dedicated sound toggle, since joining/creating a room is itself a qualifying click. */
export function wireAutoInitOnFirstInteraction(): void {
  if (typeof document === 'undefined') return;
  const handler = () => {
    initAudio();
    if (!muted) setAmbience('menu');
    document.removeEventListener('pointerdown', handler);
  };
  document.addEventListener('pointerdown', handler, { once: true });
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  localStorage.setItem(MUTE_STORAGE_KEY, String(value));
  if (masterGain) masterGain.gain.value = value ? 0 : 1;

  if (value) {
    gameMusicElA?.pause();
    gameMusicElB?.pause();
    ambienceElA?.pause();
    ambienceElB?.pause();
    voicesWarningEl?.pause();
    return;
  }

  initAudio();
  // Resume whichever track/ambience/warning was actually supposed to be
  // playing (gameMusicMode/currentAmbienceKind/voicesWarningIntensity all
  // survive muting, even though actual playback was paused while muted)
  // - resumes the same paused element rather than picking something new,
  // same as hitting "play" again on any paused <audio> element.
  const el = activeGameMusicEl();
  if (gameMusicMode && el) {
    el.volume = MAX_GAME_MUSIC_VOLUME * musicVolume;
    el.play().catch(() => {});
  }
  const ambEl = activeAmbienceEl();
  if (currentAmbienceKind && ambEl) {
    ambEl.volume = MAX_AMBIENCE_VOLUME * musicVolume;
    ambEl.play().catch(() => {});
  }
  if (voicesWarningIntensity > 0 && voicesWarningEl) {
    voicesWarningEl.volume = MAX_VOICES_WARNING_VOLUME * musicVolume * voicesWarningIntensity;
    voicesWarningEl.play().catch(() => {});
  }
}

export function toggleMuted(): boolean {
  setMuted(!muted);
  return muted;
}

// --- Sound effect primitives --------------------------------------------

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = 'square',
  gainValue = 0.3,
  when = 0,
): void {
  const ctx = ensureContext();
  if (!ctx || !sfxGain) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const start = ctx.currentTime + when;
  gain.gain.setValueAtTime(gainValue, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(sfxGain);
  osc.start(start);
  osc.stop(start + duration);
}

function sweep(startFreq: number, endFreq: number, duration: number, type: OscillatorType = 'sine', gainValue = 0.3): void {
  const ctx = ensureContext();
  if (!ctx || !sfxGain) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);
  gain.gain.setValueAtTime(gainValue, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(sfxGain);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

function noiseBurst(duration: number, gainValue = 0.2): void {
  const ctx = ensureContext();
  if (!ctx || !sfxGain) return;
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = gainValue;
  source.connect(gain);
  gain.connect(sfxGain);
  source.start();
}

// --- Named sound effects --------------------------------------------------

export function playDiceTick(): void {
  tone(200 + Math.random() * 120, 0.045, 'square', 0.12);
}

export function playDiceLand(): void {
  tone(440, 0.09, 'triangle', 0.25);
  tone(330, 0.12, 'triangle', 0.2, 0.05);
}

/** Buying, paying/collecting rent, mortgaging - anything Credits-changing-hands. */
export function playCash(): void {
  sweep(600, 1300, 0.14, 'square', 0.2);
  tone(1500, 0.08, 'square', 0.15, 0.1);
}

export function playCardDraw(): void {
  sweep(320, 900, 0.18, 'sawtooth', 0.15);
  noiseBurst(0.05, 0.06);
}

export function playJail(): void {
  tone(160, 0.22, 'sawtooth', 0.22);
  tone(120, 0.28, 'sawtooth', 0.22, 0.16);
}

/** A gunshot: a sharp noise crack with a very fast low-frequency thump underneath for body, both decaying almost immediately - "sent to the wall," not a gentle fade-out. */
export function playDisappear(): void {
  noiseBurst(0.1, 0.55);
  sweep(180, 40, 0.14, 'sawtooth', 0.4);
}

export function playEndgameFanfare(): void {
  const notes = [523.25, 659.25, 784.0, 1046.5]; // C E G C
  notes.forEach((freq, i) => tone(freq, 0.35, 'square', 0.22, i * 0.15));
}

/** A Wing forcibly changing hands with no Credits involved - Rogue Anomaly's auto-consume, Logistics Officer's auto-requisition, MTF Operative's Show of Force. Harsher/darker than playCash, since nobody got paid for this. */
export function playSeize(): void {
  sweep(500, 150, 0.28, 'sawtooth', 0.25);
  noiseBurst(0.08, 0.12);
}

/**
 * One "distant explosion" - Chernobyl destroying a property. Called
 * once per destroyed tile, staggered a beat apart (see
 * useDestructionBursts), so several of these in a row should read as
 * a rolling series of far-off booms, not one sharp bang up close: a
 * dull sine sweep rather than a harsh sawtooth, low gain, and a slower
 * decay than playSeize's quick heist-like sting. Randomizes its own
 * pitch/gain a little each call so a run of them doesn't sound like
 * the exact same clip playing back to back.
 */
export function playExplosion(): void {
  const variance = 0.85 + Math.random() * 0.3; // 0.85x-1.15x
  sweep(220 * variance, 30 * variance, 0.75, 'sine', 0.16 * variance);
  noiseBurst(0.45, 0.1 * variance);
}

/** Plays the instant it becomes a player's own turn - a cue to notice even if they're not looking at the board (alt-tabbed, etc). */
export function playYourTurn(): void {
  tone(494, 0.1, 'triangle', 0.22);
  tone(659, 0.16, 'triangle', 0.22, 0.1);
}

/** The "are you still there?" AFK prompt appearing (see useAfkSelfCheck) - deliberately more insistent than playYourTurn, since this one means a countdown to an automatic skip has already started. */
export function playAfkAlert(): void {
  tone(220, 0.12, 'square', 0.2);
  tone(220, 0.12, 'square', 0.2, 0.2);
  tone(220, 0.12, 'square', 0.2, 0.4);
}

// --- Background music: real tracks for in-game play -----------------------
//
// Two pools of real audio files (public/audio/): "standard" tracks
// shuffle continuously during normal play; once the Endgame's final lap
// starts, one "final" (LMS - Last Man Standing) track is chosen at
// random and just loops for the rest of the match instead of continuing
// to shuffle. Plain <audio> elements rather than the Web Audio graph
// above - these are multi-minute files, and <audio> streams them
// instead of decoding the whole thing into memory up front the way Web
// Audio's decodeAudioData would. See the Ambience section further down
// for the separate, quieter layer that plays underneath these (and
// underneath silence, on the menu).
//
// Two elements (not one) so a transition can be a real crossfade: the
// incoming track fades in on whichever element is currently idle while
// the outgoing one fades out on the other, instead of a hard src swap.

// Exposed (as name/url pairs) for the Dev Panel's track switcher and
// the "now playing" banner - everything else in this module just
// picks from these by index.
const STANDARD_FILES = [
  { name: 'House Edge', file: 'standard-house-edge.mp3' },
  { name: 'House of Black Dice', file: 'standard-house-of-black-dice.mp3' },
  { name: 'House of Chips', file: 'standard-house-of-chips.mp3' },
  { name: 'The Hollow Between', file: 'standard-hollow-between.mp3' },
  { name: 'The Hollow Between (Variation)', file: 'standard-hollow-between-variation.mp3' },
];
const FINAL_FILES = [
  { name: 'Foundry of Ash', file: 'lms-foundry-of-ash.mp3' },
  { name: 'Ritual of the Rumble', file: 'lms-ritual-of-the-rumble.mp3' },
  { name: 'Warzone Pulse', file: 'lms-warzone-pulse.mp3' },
  { name: 'Warzone Pulse (Variation)', file: 'lms-warzone-pulse-variation.mp3' },
  { name: 'Warzone Riffline', file: 'lms-warzone-riffline.mp3' },
];
export const STANDARD_TRACKS = STANDARD_FILES.map(({ name, file }) => ({
  name,
  url: `${import.meta.env.BASE_URL}audio/${file}`,
}));
export const FINAL_TRACKS = FINAL_FILES.map(({ name, file }) => ({
  name,
  url: `${import.meta.env.BASE_URL}audio/${file}`,
}));

const CROSSFADE_MS = 1800;

let gameMusicElA: HTMLAudioElement | null = null;
let gameMusicElB: HTMLAudioElement | null = null;
let activeSlot: 'A' | 'B' = 'A';
let gameMusicMode: 'standard' | 'final' | null = null;
let lastStandardTrackIndex: number | null = null;

function activeGameMusicEl(): HTMLAudioElement | null {
  return activeSlot === 'A' ? gameMusicElA : gameMusicElB;
}

function inactiveGameMusicEl(): HTMLAudioElement | null {
  return activeSlot === 'A' ? gameMusicElB : gameMusicElA;
}

function ensureGameMusicElements(): boolean {
  if (typeof Audio === 'undefined') return false;
  if (!gameMusicElA) {
    gameMusicElA = new Audio();
    gameMusicElA.volume = 0;
  }
  if (!gameMusicElB) {
    gameMusicElB = new Audio();
    gameMusicElB.volume = 0;
  }
  return true;
}

/** Ramps one element's volume toward `to` over `durationMs`, in small steps rather than jumping straight there - the actual "fade" in a crossfade. */
function fadeVolume(el: HTMLAudioElement, to: number, durationMs: number, onDone?: () => void): void {
  const from = el.volume;
  const stepMs = 40;
  const steps = Math.max(1, Math.round(durationMs / stepMs));
  let step = 0;
  const timer = setInterval(() => {
    step++;
    const t = Math.min(1, step / steps);
    el.volume = Math.max(0, Math.min(1, from + (to - from) * t));
    if (t >= 1) {
      clearInterval(timer);
      onDone?.();
    }
  }, stepMs);
}

// Which in-game track is playing right now, and who's watching for it
// to change - drives the "now playing" banner (see useCurrentGameTrackName/
// NowPlayingBanner). Purely a UI hook; nothing in this module reads it.
let currentGameTrackName: string | null = null;
const gameTrackListeners = new Set<(name: string | null) => void>();

export function getCurrentGameTrackName(): string | null {
  return currentGameTrackName;
}

/** Subscribes to in-game track changes - returns an unsubscribe function. */
export function onGameTrackChange(listener: (name: string | null) => void): () => void {
  gameTrackListeners.add(listener);
  return () => gameTrackListeners.delete(listener);
}

function notifyGameTrack(name: string | null): void {
  currentGameTrackName = name;
  gameTrackListeners.forEach((listener) => listener(name));
}

/**
 * Crossfades from whichever track is currently active to a new one:
 * the incoming track plays on the idle element starting from silence
 * and ramps up, while the outgoing one ramps down and then pauses -
 * both at once, so there's no dead air or hard cut between them. While
 * muted, nothing's audible either way, so this just swaps the src
 * instantly instead of animating a fade nobody can hear (and skips
 * play() entirely, same as before, so unmuting later resumes cleanly).
 */
function transitionGameMusic(url: string, loop: boolean, onEnded: (() => void) | null): void {
  if (!ensureGameMusicElements()) return;
  const outgoing = activeGameMusicEl();
  const incoming = inactiveGameMusicEl();
  if (!outgoing || !incoming) return;
  const targetVolume = MAX_GAME_MUSIC_VOLUME * musicVolume;

  outgoing.onended = null;
  incoming.loop = loop;
  incoming.onended = onEnded;
  incoming.src = url;

  if (muted) {
    outgoing.pause();
    incoming.volume = 0;
  } else {
    incoming.volume = 0;
    incoming.play().catch(() => {
      // Refused (no gesture yet, still loading, etc.) - harmless, whatever
      // triggers next (a click, the next call) will retry.
    });
    fadeVolume(incoming, targetVolume, CROSSFADE_MS);
    fadeVolume(outgoing, 0, CROSSFADE_MS, () => outgoing.pause());
  }

  activeSlot = activeSlot === 'A' ? 'B' : 'A';
}

/** Picks (and crossfades to) a new random standard track, avoiding an immediate repeat. */
function playStandardTrack(): void {
  let index = Math.floor(Math.random() * STANDARD_TRACKS.length);
  if (STANDARD_TRACKS.length > 1 && index === lastStandardTrackIndex) {
    index = (index + 1) % STANDARD_TRACKS.length;
  }
  lastStandardTrackIndex = index;
  const track = STANDARD_TRACKS[index];
  transitionGameMusic(track.url, false, () => {
    if (gameMusicMode === 'standard') playStandardTrack();
  });
  notifyGameTrack(track.name);
}

/**
 * Shuffles continuously among the "standard" gameplay tracks - each one
 * plays once through, then a different one is picked. Call once when a
 * game actually starts.
 */
export function startGameMusic(): void {
  if (!ensureGameMusicElements()) return;
  if (gameMusicMode === 'standard') return; // already doing this
  gameMusicMode = 'standard';
  playStandardTrack();
}

/** Switches to a single randomly-chosen "final round" (LMS) track, looped for the rest of the match. Call once when the Endgame's final lap begins. */
export function startFinalRoundMusic(): void {
  if (!ensureGameMusicElements()) return;
  if (gameMusicMode === 'final') return; // already doing this
  gameMusicMode = 'final';
  const track = FINAL_TRACKS[Math.floor(Math.random() * FINAL_TRACKS.length)];
  transitionGameMusic(track.url, true, null);
  notifyGameTrack(track.name);
}

/** Stops whichever in-game track (standard or final) is currently playing. Call when leaving a game back to the lobby/menu. Instant, not a fade - there's nothing to crossfade into. */
export function stopGameMusic(): void {
  gameMusicMode = null;
  if (gameMusicElA) {
    gameMusicElA.onended = null;
    gameMusicElA.pause();
  }
  if (gameMusicElB) {
    gameMusicElB.onended = null;
    gameMusicElB.pause();
  }
  notifyGameTrack(null);
}

/**
 * Dev Panel track switcher: forces a specific track to play right now,
 * bypassing the normal shuffle/pick-at-random logic - lets someone
 * preview any of the 10 without waiting for it to come up naturally.
 * Standard tracks picked this way still auto-advance (to another
 * random standard track) when they end, same as the real thing; a
 * final track picked this way just loops, same as the real thing.
 */
export function debugPlayGameTrack(kind: 'standard' | 'final', index: number): void {
  if (!ensureGameMusicElements()) return;
  const track = (kind === 'standard' ? STANDARD_TRACKS : FINAL_TRACKS)[index];
  if (!track) return;

  gameMusicMode = kind;
  if (kind === 'standard') {
    lastStandardTrackIndex = index;
    transitionGameMusic(track.url, false, () => {
      if (gameMusicMode === 'standard') playStandardTrack();
    });
  } else {
    transitionGameMusic(track.url, true, null);
  }
  notifyGameTrack(track.name);
}

// --- Ambience: a quiet loop layered underneath whatever music (or
// silence) is currently playing ---------------------------------------
//
// Three loops, one active at a time: 'menu' on the landing/lobby screen,
// 'general' for ordinary in-game play, 'pocketDimension' specifically
// while SCP-106's Pocket Dimension ordeal is underway (see useGameMusic).
// Same crossfade-via-two-elements approach as the game music tracks
// above, but entirely independent of it - this plays simultaneously
// with music, not instead of it, at MAX_AMBIENCE_VOLUME rather than
// MAX_GAME_MUSIC_VOLUME.

export type AmbienceKind = 'menu' | 'general' | 'pocketDimension';

const AMBIENCE_FILES: Record<AmbienceKind, string> = {
  menu: 'ambience-menu.mp3',
  general: 'ambience-general.mp3',
  pocketDimension: 'ambience-pocket-dimension.mp3',
};

function ambienceUrl(kind: AmbienceKind): string {
  return `${import.meta.env.BASE_URL}audio/${AMBIENCE_FILES[kind]}`;
}

let ambienceElA: HTMLAudioElement | null = null;
let ambienceElB: HTMLAudioElement | null = null;
let activeAmbienceSlot: 'A' | 'B' = 'A';
let currentAmbienceKind: AmbienceKind | null = null;

function activeAmbienceEl(): HTMLAudioElement | null {
  return activeAmbienceSlot === 'A' ? ambienceElA : ambienceElB;
}

function inactiveAmbienceEl(): HTMLAudioElement | null {
  return activeAmbienceSlot === 'A' ? ambienceElB : ambienceElA;
}

function ensureAmbienceElements(): boolean {
  if (typeof Audio === 'undefined') return false;
  if (!ambienceElA) {
    ambienceElA = new Audio();
    ambienceElA.volume = 0;
  }
  if (!ambienceElB) {
    ambienceElB = new Audio();
    ambienceElB.volume = 0;
  }
  return true;
}

export function getCurrentAmbienceKind(): AmbienceKind | null {
  return currentAmbienceKind;
}

/**
 * Crossfades to the given ambience loop, or fades out to silence if
 * `kind` is null. No-op if that kind is already playing. See
 * transitionGameMusic above for the identical crossfade mechanics -
 * this is the same idea on its own pair of elements so it can run
 * simultaneously with (not instead of) the music tracks.
 */
export function setAmbience(kind: AmbienceKind | null): void {
  if (kind === currentAmbienceKind) return;
  currentAmbienceKind = kind;
  if (!ensureAmbienceElements()) return;
  const outgoing = activeAmbienceEl();
  const incoming = inactiveAmbienceEl();
  if (!outgoing || !incoming) return;

  if (kind === null) {
    if (muted) {
      outgoing.pause();
    } else {
      fadeVolume(outgoing, 0, CROSSFADE_MS, () => outgoing.pause());
    }
    return;
  }

  incoming.loop = true;
  incoming.src = ambienceUrl(kind);

  if (muted) {
    outgoing.pause();
    incoming.volume = 0;
  } else {
    incoming.volume = 0;
    incoming.play().catch(() => {
      // Refused (no gesture yet, still loading, etc.) - harmless, whatever
      // triggers next (a click, the next call) will retry.
    });
    fadeVolume(incoming, MAX_AMBIENCE_VOLUME * musicVolume, CROSSFADE_MS);
    fadeVolume(outgoing, 0, CROSSFADE_MS, () => outgoing.pause());
  }

  activeAmbienceSlot = activeAmbienceSlot === 'A' ? 'B' : 'A';
}

// --- One-shot real-file sound effect ---------------------------------------

const ENTER_RAGE_STINGER_URL = `${import.meta.env.BASE_URL}audio/096-enter-rage.mp3`;
const ENTER_RAGE_STINGER_VOLUME = 0.4;

/**
 * SCP-096's "entered rage" stinger - played the instant it starts
 * hunting (see useSoundEvents). A real audio file rather than a
 * synthesized tone, so unlike every other playX function above it isn't
 * routed through the Web Audio graph - just a fresh <audio> element each
 * call, which means it has to check the mute toggle itself rather than
 * inheriting it from masterGain.
 */
export function playEnterRageStinger(): void {
  if (muted || typeof Audio === 'undefined') return;
  const audio = new Audio(ENTER_RAGE_STINGER_URL);
  audio.volume = ENTER_RAGE_STINGER_VOLUME;
  audio.play().catch(() => {});
}

// --- SCP-939's personal early-warning loop ---------------------------------
//
// Since SCP-939's own breach and hunt are otherwise completely silent
// and invisible (see setAmbience's usage and Board.tsx), the one player
// it's currently approaching gets a private cue instead - nobody else
// hears this. A single looping element (not a crossfading pair like
// ambience/music above) since there's only ever one thing to play here:
// on or off (and how loud), for whichever single player it's meant for
// on this client. Volume scales with proximity (see useVoicesWarning) -
// a shorter fade than the ambience/music crossfades above, since this
// updates every time distance changes (once a round) rather than only
// on a real track/scene change.

const VOICES_WARNING_URL = `${import.meta.env.BASE_URL}audio/warning-939.mp3`;
const VOICES_WARNING_FADE_MS = 600;

let voicesWarningEl: HTMLAudioElement | null = null;
let voicesWarningIntensity = 0;

/**
 * Fades the SCP-939 early-warning loop toward a given 0-1 closeness -
 * 0 silences and eventually pauses it, anything above 0 plays (or keeps
 * playing) at a proportional volume. Call every time proximity changes
 * (see useVoicesWarning) - no-op if already at this exact intensity.
 */
export function setVoicesWarning(closeness: number): void {
  const clamped = clamp01(closeness);
  if (clamped === voicesWarningIntensity) return;
  const wasSilent = voicesWarningIntensity === 0;
  voicesWarningIntensity = clamped;
  if (typeof Audio === 'undefined') return;
  if (!voicesWarningEl) {
    voicesWarningEl = new Audio(VOICES_WARNING_URL);
    voicesWarningEl.loop = true;
    voicesWarningEl.volume = 0;
  }
  const el = voicesWarningEl;

  if (clamped === 0) {
    if (muted) {
      el.pause();
    } else {
      fadeVolume(el, 0, VOICES_WARNING_FADE_MS, () => el.pause());
    }
    return;
  }

  const targetVolume = MAX_VOICES_WARNING_VOLUME * musicVolume * clamped;
  if (muted) {
    el.volume = 0;
    return;
  }
  if (wasSilent) el.play().catch(() => {});
  fadeVolume(el, targetVolume, VOICES_WARNING_FADE_MS);
}
