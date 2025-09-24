import { Word } from '../types/word';

// 구글 시트에서 단어 데이터를 가져오는 서비스
export class GoogleSheetsService {
  private static readonly SHEET_ID = process.env.REACT_APP_GOOGLE_SHEET_ID || '';
  private static readonly API_KEY = process.env.REACT_APP_GOOGLE_API_KEY || '';

  static async fetchWords(): Promise<Word[]> {
    console.log('🔍 구글 시트 데이터 로드 시작...');
    console.log('📊 설정 정보:', {
      sheetId: this.SHEET_ID,
      hasApiKey: !!this.API_KEY && this.API_KEY !== 'your_google_api_key_here',
      apiKeyPrefix: this.API_KEY ? this.API_KEY.substring(0, 10) + '...' : '없음'
    });

    // API 키 없이도 구글 시트 공개 링크로 접근 시도
    if (!this.SHEET_ID) {
      console.warn('❌ 구글 시트 ID가 설정되지 않았습니다.');
      console.log('💡 해결 방법:');
      console.log('   1. .env 파일을 생성하세요');
      console.log('   2. REACT_APP_GOOGLE_SHEET_ID=your_sheet_id 설정하세요');
      console.log('   3. 서버를 재시작하세요');
      return [];
    }

    // API 키가 있으면 Google Sheets API 사용
    if (this.API_KEY && this.API_KEY !== 'your_google_api_key_here') {
      try {
        console.log('🚀 Google Sheets API로 데이터 로드 시도...');
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.SHEET_ID}/values/Sheet1?key=${this.API_KEY}`;
        console.log('📡 API URL:', url);
        
        const response = await fetch(url);
        console.log('📨 API 응답 상태:', response.status, response.statusText);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('📋 API 응답 데이터:', data);
        
        const words = this.parseSheetData(data.values);
        console.log('✅ API로 로드된 단어 수:', words.length);
        if (words.length > 0) {
          console.log('📝 첫 번째 단어:', words[0]);
        }
        return words;
      } catch (error) {
        console.error('❌ 구글 시트 API 데이터 로드 실패:', error);
        console.log('🔄 공개 CSV 링크로 시도합니다.');
      }
    }

    // API 키가 없거나 실패하면 여러 방법으로 시도
    const methods = [
      {
        name: 'CSV Export (public sharing)',
        url: `https://docs.google.com/spreadsheets/d/${this.SHEET_ID}/export?format=csv&gid=0&usp=sharing`
      },
      {
        name: 'CSV Export (basic)',
        url: `https://docs.google.com/spreadsheets/d/${this.SHEET_ID}/export?format=csv`
      },
      {
        name: 'CSV Export (with gid)',
        url: `https://docs.google.com/spreadsheets/d/${this.SHEET_ID}/export?format=csv&gid=0`
      },
      {
        name: 'CSV Export (range A:Z)',
        url: `https://docs.google.com/spreadsheets/d/${this.SHEET_ID}/export?format=csv&range=A:Z`
      },
      {
        name: 'CSV Export (single sheet)',
        url: `https://docs.google.com/spreadsheets/d/${this.SHEET_ID}/export?format=csv&gid=0&single=true`
      },
      {
        name: 'TSV Export',
        url: `https://docs.google.com/spreadsheets/d/${this.SHEET_ID}/export?format=tsv&gid=0`
      },
      {
        name: 'CSV Export (no gid)',
        url: `https://docs.google.com/spreadsheets/d/${this.SHEET_ID}/export?format=csv&usp=sharing`
      }
    ];

    for (const method of methods) {
      try {
        console.log(`🚀 ${method.name}로 데이터 로드 시도...`);
        console.log('📡 URL:', method.url);
        
        const response = await fetch(method.url, {
          mode: 'cors',
          credentials: 'omit'
        });
        console.log('📨 응답 상태:', response.status, response.statusText);
        
        if (!response.ok) {
          throw new Error(`${method.name} failed! status: ${response.status}`);
        }
        
        const text = await response.text();
        console.log('📄 응답 데이터 (처음 500자):', text.substring(0, 500));
        
        // CSV 또는 TSV 파싱
        const words = method.name.includes('TSV') ? this.parseTsvData(text) : this.parseCsvData(text);
        console.log(`✅ ${method.name}로 로드된 단어 수:`, words.length);
        
        if (words.length > 0) {
          console.log('📝 첫 번째 단어:', words[0]);
          return words;
        }
      } catch (error) {
        console.error(`❌ ${method.name} 실패:`, error);
      }
    }

    console.error('❌ 모든 구글 시트 접근 방법 실패');
    console.log('💡 구글 시트 접근 문제 해결 방법:');
    console.log('   1. 구글 시트가 공개 설정되어 있는지 확인하세요');
    console.log('      - 구글 시트 → 공유 → "링크가 있는 모든 사용자" 선택');
    console.log('   2. 시트 ID가 올바른지 확인하세요');
    console.log('      - URL: https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit');
    console.log('   3. .env 파일에 올바른 시트 ID가 설정되어 있는지 확인하세요');
    console.log('      - REACT_APP_GOOGLE_SHEET_ID=19GeI9owRZ78a2VCIM7gAvInizdGi4rF2MfvNQ80rgw4');
    console.log('   4. 서버를 재시작하세요 (npm start)');
    console.log('🔄 빈 배열을 반환합니다. (App.tsx에서 샘플 데이터 처리)');
    return [];
  }

  private static parseSheetData(values: string[][]): Word[] {
    if (!values || values.length < 2) {
      console.warn('⚠️ 구글 시트 데이터가 비어있습니다.');
      return [];
    }

    const [, ...rows] = values; // headers 변수 제거
    const words: Word[] = [];

    rows.forEach((row, index) => {
      if (row.length >= 2) {
        words.push({
          id: `word_${index + 1}`,
          english: row[0]?.trim() || '',
          korean: row[1]?.trim() || '',
          imageUrl: row[2]?.trim() || undefined
        });
      }
    });

    return words.filter(word => word.english && word.korean);
  }

  private static parseCsvData(csvText: string): Word[] {
    console.log('🔧 CSV 데이터 파싱 시작...');
    const lines = csvText.split('\n').filter(line => line.trim());
    console.log('📄 총 라인 수:', lines.length);
    console.log('📋 첫 번째 라인 (헤더):', lines[0]);
    
    if (lines.length < 2) {
      console.warn('⚠️ 데이터 라인이 부족합니다.');
      return [];
    }

    const words: Word[] = [];
    const [, ...rows] = lines; // 헤더 제거
    console.log('📊 데이터 라인 수:', rows.length);

    rows.forEach((line, index) => {
      console.log(`🔍 라인 ${index + 1} 파싱:`, line);
      
      // CSV 파싱 (쉼표로 분리, 따옴표 처리)
      const columns = this.parseCsvLine(line);
      console.log(`📝 파싱된 컬럼들:`, columns);
      
      if (columns.length >= 2 && columns[0].trim() && columns[1].trim()) {
        const word: Word = {
          id: `word_${index + 1}`,
          english: columns[0]?.trim() || '',
          korean: columns[1]?.trim() || '',
          imageUrl: columns[2]?.trim() || undefined
        };
        words.push(word);
        console.log(`✅ 단어 추가됨:`, word);
      } else {
        console.log(`⚠️ 라인 ${index + 1} 건너뜀 - 유효하지 않은 데이터`);
      }
    });

    const validWords = words.filter(word => word.english && word.korean);
    console.log('🎯 최종 유효한 단어 수:', validWords.length);
    return validWords;
  }

  private static parseTsvData(tsvText: string): Word[] {
    console.log('🔧 TSV 데이터 파싱 시작...');
    const lines = tsvText.split('\n').filter(line => line.trim());
    console.log('📄 총 라인 수:', lines.length);
    console.log('📋 첫 번째 라인 (헤더):', lines[0]);
    
    if (lines.length < 2) {
      console.warn('⚠️ 데이터 라인이 부족합니다.');
      return [];
    }

    const words: Word[] = [];
    const [, ...rows] = lines; // 헤더 제거
    console.log('📊 데이터 라인 수:', rows.length);

    rows.forEach((line, index) => {
      console.log(`🔍 라인 ${index + 1} 파싱:`, line);
      
      // TSV 파싱 (탭으로 분리)
      const columns = line.split('\t').map(col => col.trim());
      console.log(`📝 파싱된 컬럼들:`, columns);
      
      if (columns.length >= 2 && columns[0] && columns[1]) {
        const word: Word = {
          id: `word_${index + 1}`,
          english: columns[0] || '',
          korean: columns[1] || '',
          imageUrl: columns[2] || undefined
        };
        words.push(word);
        console.log(`✅ 단어 추가됨:`, word);
      } else {
        console.log(`⚠️ 라인 ${index + 1} 건너뜀 - 유효하지 않은 데이터`);
      }
    });

    const validWords = words.filter(word => word.english && word.korean);
    console.log('🎯 최종 유효한 단어 수:', validWords.length);
    return validWords;
  }

  private static parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result;
  }

  private static getSampleWords(): Word[] {
    return [
      {
        id: 'sample_1',
        english: 'apple',
        korean: '사과',
        imageUrl: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400'
      },
      {
        id: 'sample_2',
        english: 'cat',
        korean: '고양이',
        imageUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400'
      },
      {
        id: 'sample_3',
        english: 'book',
        korean: '책',
        imageUrl: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400'
      },
      {
        id: 'sample_4',
        english: 'dog',
        korean: '개',
        imageUrl: 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=400'
      },
      {
        id: 'sample_5',
        english: 'house',
        korean: '집',
        imageUrl: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400'
      },
      
    ];
  }
}
