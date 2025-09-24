# 🎓 영어 단어 익히기 앱

제미나이 AI를 활용한 영어 단어 학습 애플리케이션입니다. 발음 연습과 퀴즈 기능을 통해 효과적인 영어 학습을 도와줍니다.

## ✨ 주요 기능

- 📚 **단어 목록**: 구글 시트 또는 내장 샘플 데이터로 단어 학습
- 🎤 **발음 연습**: AI 기반 발음 분석 및 피드백
- 🧠 **퀴즈**: AI가 생성한 객관식 문제로 실력 테스트
- 📱 **반응형 디자인**: 모바일과 데스크톱 모두 지원

## 🚀 시작하기

### 1. 프로젝트 설치

```bash
# 의존성 설치
npm install

# 개발 서버 시작
npm start
```

### 2. 환경 변수 설정

`.env` 파일을 생성하고 다음 내용을 추가하세요:

```env
# 제미나이 API 키 (필수)
REACT_APP_GEMINI_API_KEY=your_gemini_api_key_here

# 구글 시트 설정 (선택사항)
REACT_APP_GOOGLE_SHEET_ID=your_google_sheet_id_here
REACT_APP_GOOGLE_API_KEY=your_google_api_key_here
```

### 3. 제미나이 API 키 발급

1. [Google AI Studio](https://makersuite.google.com/app/apikey)에 접속
2. API 키 생성
3. `.env` 파일에 키 추가

## 📊 구글 시트 연동 (선택사항)

구글 시트를 사용하여 단어 데이터를 관리할 수 있습니다.

### 시트 구조

| A (영어) | B (한국어) | C (발음) | D (예문) | E (난이도) | F (카테고리) |
|----------|------------|----------|----------|------------|--------------|
| apple    | 사과       | /ˈæpəl/  | I eat an apple every day. | easy | food |
| beautiful | 아름다운 | /ˈbjuːtɪfəl/ | The sunset is beautiful. | medium | adjective |

### 구글 API 설정

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트 생성
2. Google Sheets API 활성화
3. API 키 생성
4. 시트를 공개로 설정 (읽기 권한)

## 🎯 사용법

### 단어 학습
1. 메인 화면에서 단어 목록 확인
2. 원하는 단어 클릭하여 선택
3. "발음 연습하기" 버튼 클릭

### 발음 연습
1. 단어의 정확한 발음 듣기
2. 마이크로 발음 녹음 또는 텍스트 입력
3. AI 분석 결과 확인 및 개선 제안 수신

### 퀴즈
1. "퀴즈 시작" 버튼 클릭
2. AI가 생성한 객관식 문제 풀기
3. 실시간 점수 확인 및 결과 분석

## 🛠️ 기술 스택

- **Frontend**: React 18, TypeScript
- **AI**: Google Gemini API
- **Data**: Google Sheets API
- **Styling**: CSS3 (Flexbox, Grid)
- **Audio**: Web Speech API

## 📱 반응형 디자인

- 모바일 우선 설계
- 태블릿 및 데스크톱 최적화
- 터치 친화적 인터페이스

## 🔧 개발 스크립트

```bash
# 개발 서버 시작
npm start

# 프로덕션 빌드
npm run build

# 테스트 실행
npm test

# 코드 린팅
npm run lint
```

## 📝 라이선스

MIT License

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 지원

문제가 있거나 제안사항이 있으시면 이슈를 생성해주세요.

---

💡 **팁**: 제미나이 API 키 없이도 샘플 데이터로 앱을 테스트할 수 있습니다!