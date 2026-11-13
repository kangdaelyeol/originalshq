#!/usr/bin/env python3
# 아톡문의 알림음 만들기 — 신규 문의(tech-new.caf)와 10분 지연(tech-delay.caf). 서버(functions-xtool
# tech-boards/push.ts ALERT_STYLE)가 이 파일 이름을 보내고, pod(XtoolPushModule.podspec resources)이 앱 번들에 넣는다.
# 소리를 바꾸려면 아래 값을 고치고 `python3 make-sounds.py`(macOS — afconvert로 CAF를 만든다) 뒤 pod install·앱 빌드.
# 들어 보기: `afplay tech-new.caf`. 알림음은 30초 이하, 크기는 폰 벨소리 음량을 따른다(무음 스위치면 진동만).
#
# - 신규: 밝은 4음 오름(도·미·솔·도) 두 번, 약 1.6초 — 반가운 알림
# - 지연: 높은 두 음을 빠르게 번갈아(경보처럼) 두 번, 약 2.8초 — 신규와 바로 구분되게 더 급하게

import math
import os
import struct
import subprocess
import tempfile
import wave

RATE = 44100
HERE = os.path.dirname(os.path.abspath(__file__))


def silence(seconds):
    return [0.0] * int(RATE * seconds)


def mix(track, sound, at):
    """track의 at초 자리에 sound를 더한다(모자라면 늘린다)"""
    start = int(RATE * at)
    end = start + len(sound)
    if len(track) < end:
        track.extend([0.0] * (end - len(track)))
    for i, value in enumerate(sound):
        track[start + i] += value
    return track


def bell(freq, seconds=0.45, decay=0.22):
    """마림바·종 같은 한 음 — 기음과 배음 둘, 짧게 올라 천천히 줄어든다"""
    out = []
    attack = int(RATE * 0.004)
    for i in range(int(RATE * seconds)):
        t = i / RATE
        env = math.exp(-t / decay) * min(1.0, i / attack)
        value = (
            math.sin(2 * math.pi * freq * t)
            + 0.35 * math.sin(2 * math.pi * freq * 2 * t) * math.exp(-t / (decay * 0.5))
            + 0.12 * math.sin(2 * math.pi * freq * 3 * t) * math.exp(-t / (decay * 0.3))
        )
        out.append(env * value)
    return out


def beep(freq, seconds=0.13, edge=0.01):
    """경보 삑 — 홀수 배음을 섞어 또렷하게, 앞뒤를 짧게 둥글려 딸깍 소리를 없앤다"""
    out = []
    n = int(RATE * seconds)
    e = int(RATE * edge)
    for i in range(n):
        t = i / RATE
        env = min(1.0, i / e, (n - 1 - i) / e)
        value = (
            math.sin(2 * math.pi * freq * t)
            + 0.3 * math.sin(2 * math.pi * freq * 3 * t)
            + 0.12 * math.sin(2 * math.pi * freq * 5 * t)
        )
        out.append(env * value)
    return out


def new_inquiry():
    notes = [1046.5, 1318.5, 1568.0, 2093.0]  # C6 E6 G6 C7
    track = silence(0.05)
    for round_start in (0.0, 0.75):
        for k, freq in enumerate(notes):
            mix(track, bell(freq), 0.02 + round_start + k * 0.1)
    return track


def delay_alarm():
    high, low = 1760.0, 1397.0  # A6 F6
    track = silence(0.05)
    for round_start in (0.0, 1.45):
        for k in range(8):
            mix(track, beep(high if k % 2 == 0 else low), 0.02 + round_start + k * 0.16)
    return track


def write_caf(name, samples):
    peak = max(abs(v) for v in samples) or 1.0
    scaled = [int(max(-1.0, min(1.0, v / peak * 0.95)) * 32767) for v in samples]
    with tempfile.TemporaryDirectory() as tmp:
        wav_path = os.path.join(tmp, 'sound.wav')
        with wave.open(wav_path, 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(RATE)
            w.writeframes(struct.pack(f'<{len(scaled)}h', *scaled))
        out = os.path.join(HERE, name)
        subprocess.run(['afconvert', '-f', 'caff', '-d', 'LEI16', wav_path, out], check=True)
    print(f'{name}: {len(samples) / RATE:.2f}s')


if __name__ == '__main__':
    write_caf('tech-new.caf', new_inquiry())
    write_caf('tech-delay.caf', delay_alarm())
