# Smart Export — Office test build

Photoshop UXP panel. 기존 빠른 내보내기 방식(`exportSelectionAsFileTypePressed`) 유지.

- JPG: 100 / 80 / 70 (기본 80)
- PNG: PNG-8 / PNG-24 선택 UI 유지. 이 명령의 quality 값은 색상 모드 선택이 아니므로 실제 PNG-8/24 변환은 보장되지 않음. 생성된 PNG의 색상 형식이 선택 값과 다르면 저장을 중단함.
- 그룹별 개별 이미지, 파일명/폴더/덮어쓰기, SVG 아이콘.
- 진단용 상세 원인/세션 토큰 재시도는 제거.

설치: 다른 Smart Export 폴더에 압축 해제, UXP Developer Tool에서 manifest.json 등록 후 Load.
실제 Photoshop 27.11에서 실행 테스트되지 않음.
