# Vote 방식 백업 (원복용)

이 폴더는 **피플 모드 vote 방식** 소스 백업입니다.

## 백업 일시
2026-02-26

## 포함 파일
- `RouletteScreen.js.bak` - 룰렛 화면 (vote 기반 finalize)
- `NameInputScreen.js.bak` - 이름 입력 화면 (참여자 수동 Roulette 진입)
- `SyncService.js.bak` - 동기화 서비스

## 원복 방법
vote 방식으로 되돌리려면:

```powershell
Copy-Item "_backup_vote_mode\RouletteScreen.js.bak" "src\screens\RouletteScreen.js"
Copy-Item "_backup_vote_mode\NameInputScreen.js.bak" "src\screens\NameInputScreen.js"
Copy-Item "_backup_vote_mode\SyncService.js.bak" "src\services\SyncService.js"
```

## 현재 방식 (B 방식)
- 피플 모드: 호스트가 스핀 → 참여자 실시간 시청 → 결과 확정 (vote 없음)
- 메뉴 모드: 기존 vote 방식 유지
