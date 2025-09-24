import { GoogleGenerativeAI } from '@google/generative-ai';
import { PronunciationResult } from '../types/word';

const API_KEY = process.env.REACT_APP_GEMINI_API_KEY || '';

// 디버깅을 위한 상세 로그
console.log('🔍 Gemini API 설정 확인:', {
  hasApiKey: !!API_KEY,
  apiKeyLength: API_KEY.length,
  apiKeyPrefix: API_KEY.length > 0 ? API_KEY.substring(0, 10) + '...' : '없음',
  isDevelopment: process.env.NODE_ENV === 'development',
  allEnvVars: Object.keys(process.env).filter(key => key.includes('GEMINI') || key.includes('REACT_APP'))
});

if (!API_KEY) {
  console.error('❌ GEMINI_API_KEY가 설정되지 않았습니다!');
  console.error('📝 해결방법: 프로젝트 루트에 .env 파일을 생성하고 다음 내용을 추가하세요:');
  console.error('REACT_APP_GEMINI_API_KEY=your_actual_api_key_here');
  console.error('그 후 개발 서버를 재시작하세요: npm start');
}

// API 키가 있을 때만 초기화
let genAI: GoogleGenerativeAI | null = null;
let model: any = null;

if (API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(API_KEY);
    model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      }
    });
    console.log('✅ Gemini 모델 초기화 성공');
  } catch (error) {
    console.error('❌ Gemini 모델 초기화 실패:', error);
  }
}

export class GeminiService {

  static async analyzePronunciation(word: string, userInput: string): Promise<PronunciationResult> {
    if (!API_KEY) {
      console.error('❌ API 키 없음');
      throw new Error('Gemini API 키가 설정되지 않았습니다. .env 파일에 REACT_APP_GEMINI_API_KEY를 추가해주세요.');
    }

    if (!model) {
      console.error('❌ 모델 초기화 실패');
      throw new Error('Gemini 모델 초기화에 실패했습니다. API 키를 확인해주세요.');
    }

    const prompt = `
초등학교 1-3학년 아이들이 이해할 수 있도록 쉽게 설명해주세요.

영어 단어: "${word}"
아이가 발음한 것: "${userInput}"

아이에게 친근하고 재미있게 평가해주세요:
1. 점수 (0-100점) - 아이가 이해하기 쉽게
2. 칭찬과 격려 메시지 (아이에게 친근하게)
3. 쉽고 재미있는 발음 연습 방법

응답 형식 (JSON):
{
  "accuracy": 85,
  "feedback": "와! 정말 잘했어요! 🎉 '애플'이라고 발음하신 게 정말 좋았어요. 조금만 더 연습하면 완벽할 거예요!",
  "suggestions": ["'애' 소리를 더 크게 해보세요 🗣️", "천천히 말해보세요 🐌", "미소를 지으며 발음해보세요 😊"]
}
`;

    try {
      console.log('🎤 발음 분석 요청 시작...');
      console.log('📝 분석 대상:', { word, userInput });
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      console.log('📨 발음 분석 응답 받음:', text.substring(0, 200) + '...');
      
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
      const jsonText = jsonMatch ? jsonMatch[1] : text;
      
      console.log('🔧 발음 분석 JSON 파싱...');
      const analysis = JSON.parse(jsonText);
      console.log('✅ 발음 분석 성공');
      
      return analysis;
    } catch (error) {
      console.error('❌ 발음 분석 오류:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('API_KEY') || error.message.includes('authentication')) {
          throw new Error('API 키가 유효하지 않습니다. 올바른 Gemini API 키를 확인해주세요.');
        } else if (error.message.includes('quota') || error.message.includes('limit')) {
          throw new Error('API 사용량 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          throw new Error('네트워크 연결을 확인해주세요.');
        }
      }
      
      throw new Error(`발음 분석에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  }

  static async getWordExplanation(word: string): Promise<{ meaning: string; example: string; pronunciation: string }> {
    if (!API_KEY) {
      throw new Error('Gemini API 키가 설정되지 않았습니다.');
    }

    const prompt = `
다음 영어 단어에 대한 상세 정보를 제공해주세요: "${word}"

응답 형식 (JSON):
{
  "meaning": "한국어 뜻",
  "example": "영어 예문",
  "pronunciation": "발음기호"
}
`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
      const jsonText = jsonMatch ? jsonMatch[1] : text;
      
      return JSON.parse(jsonText);
    } catch (error) {
      console.error('단어 설명 생성 오류:', error);
      throw new Error('단어 설명 생성에 실패했습니다.');
    }
  }

  // API 연결 테스트 함수
  static async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    if (!API_KEY) {
      return {
        success: false,
        message: 'API 키가 설정되지 않았습니다.',
        details: { hasApiKey: false }
      };
    }

    if (!model) {
      return {
        success: false,
        message: '모델이 초기화되지 않았습니다.',
        details: { hasModel: false }
      };
    }

    try {
      console.log('🔍 Gemini API 연결 테스트 시작...');
      const result = await model.generateContent('안녕하세요. 간단한 테스트입니다.');
      const response = await result.response;
      const text = response.text();
      
      console.log('✅ Gemini API 연결 성공:', text.substring(0, 50) + '...');
      return {
        success: true,
        message: 'API 연결이 정상입니다.',
        details: { response: text.substring(0, 100) }
      };
    } catch (error) {
      console.error('❌ Gemini API 연결 실패:', error);
      return {
        success: false,
        message: `API 연결 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        details: { error }
      };
    }
  }
}
