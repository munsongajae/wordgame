import { Word, SentenceProblem } from '../types/word';

// 구글 시트에서 단어 데이터를 가져오는 서비스
export class GoogleSheetsService {
  private static readonly SHEET_ID = process.env.REACT_APP_GOOGLE_SHEET_ID || '';
  private static readonly API_KEY = process.env.REACT_APP_GOOGLE_API_KEY || '';
  private static readonly CACHE_KEY = 'google_sheets_words_cache';
  private static readonly CACHE_TIME_KEY = 'google_sheets_words_cache_time';
  private static readonly CACHE_DURATION = 60 * 60 * 1000; // 1시간 (밀리초)

  // 캐시에서 단어 가져오기
  static getWordsFromCache(): Word[] | null {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      const cacheTime = localStorage.getItem(this.CACHE_TIME_KEY);
      
      if (!cached || !cacheTime) {
        console.log('📦 캐시 없음');
        return null;
      }

      const now = Date.now();
      const age = now - parseInt(cacheTime);
      
      if (age > this.CACHE_DURATION) {
        console.log(`⏰ 캐시 만료됨 (${Math.round(age / 1000 / 60)}분 경과)`);
        this.clearCache();
        return null;
      }

      const words = JSON.parse(cached) as Word[];
      console.log(`✅ 캐시에서 ${words.length}개 단어 로드 (${Math.round(age / 1000 / 60)}분 전 캐시)`);
      return words;
    } catch (error) {
      console.error('❌ 캐시 읽기 실패:', error);
      this.clearCache();
      return null;
    }
  }

  // 캐시에 단어 저장
  static saveWordsToCache(words: Word[]): void {
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(words));
      localStorage.setItem(this.CACHE_TIME_KEY, Date.now().toString());
      console.log(`💾 ${words.length}개 단어를 캐시에 저장`);
    } catch (error) {
      console.error('❌ 캐시 저장 실패:', error);
    }
  }

  // 캐시 삭제
  static clearCache(): void {
    localStorage.removeItem(this.CACHE_KEY);
    localStorage.removeItem(this.CACHE_TIME_KEY);
    console.log('🗑️ 캐시 삭제됨');
  }

  // 캐시를 사용하는 fetchWords (기본 메서드)
  static async fetchWordsWithCache(forceRefresh: boolean = false): Promise<Word[]> {
    // 강제 새로고침이 아니면 캐시 확인
    if (!forceRefresh) {
      const cached = this.getWordsFromCache();
      if (cached) {
        return cached;
      }
    }

    console.log('🌐 Google Sheets에서 새로운 데이터 가져오기...');
    const words = await this.fetchWords();
    
    if (words.length > 0) {
      this.saveWordsToCache(words);
    }
    
    return words;
  }

  static async fetchSentenceProblems(): Promise<SentenceProblem[]> {
    console.log('🔍 구글 시트 시트2번 문장 문제 데이터 로드 시작...');
    console.log('📊 설정 정보:', {
      sheetId: this.SHEET_ID,
      hasApiKey: !!this.API_KEY && this.API_KEY !== 'your_google_api_key_here',
      apiKeyPrefix: this.API_KEY ? this.API_KEY.substring(0, 10) + '...' : '없음'
    });

    if (!this.SHEET_ID) {
      console.warn('❌ 구글 시트 ID가 설정되지 않았습니다.');
      return [];
    }

    // 먼저 시트 정보를 가져와서 정확한 gid 찾기
    if (this.API_KEY && this.API_KEY !== 'your_google_api_key_here') {
      try {
        console.log('🔍 시트 정보 조회 중...');
        const sheetsInfoUrl = `https://sheets.googleapis.com/v4/spreadsheets/${this.SHEET_ID}?key=${this.API_KEY}`;
        const sheetsResponse = await fetch(sheetsInfoUrl);
        
        if (sheetsResponse.ok) {
          const sheetsData = await sheetsResponse.json();
          console.log('📋 시트 정보:', sheetsData.sheets?.map((s: any) => ({
            title: s.properties?.title,
            sheetId: s.properties?.sheetId,
            index: s.properties?.index
          })));
        }
      } catch (error) {
        console.log('⚠️ 시트 정보 조회 실패:', error);
      }
    }

    // API 키가 있으면 Google Sheets API 사용
    if (this.API_KEY && this.API_KEY !== 'your_google_api_key_here') {
      const sheetNames = ['Sheet2', '시트2', 'sheet2'];
      
      for (const sheetName of sheetNames) {
        try {
          console.log(`🚀 Google Sheets API로 ${sheetName} 데이터 로드 시도...`);
          const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.SHEET_ID}/values/${sheetName}?key=${this.API_KEY}`;
          console.log('📡 API URL:', url);
          
          const response = await fetch(url);
          console.log('📨 API 응답 상태:', response.status, response.statusText);
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          console.log('📋 API 응답 데이터:', data);
          
          if (data.values && data.values.length > 0) {
            const problems = this.parseSentenceData(data.values);
            console.log(`✅ API로 ${sheetName}에서 로드된 문장 문제 수:`, problems.length);
            return problems;
          }
        } catch (error) {
          console.error(`❌ ${sheetName} API 데이터 로드 실패:`, error);
        }
      }
      
      console.log('🔄 모든 시트명 시도 실패, 공개 CSV 링크로 시도합니다.');
    }

    // API 키가 없거나 실패하면 CSV Export 시도
    const methods = [
      // 시트2번은 보통 gid=1이지만, 경우에 따라 다를 수 있음
      {
        name: 'CSV Export (Sheet2, gid=1, public sharing)',
        url: `https://docs.google.com/spreadsheets/d/${this.SHEET_ID}/export?format=csv&gid=1&usp=sharing`
      },
      {
        name: 'CSV Export (Sheet2, gid=1)',
        url: `https://docs.google.com/spreadsheets/d/${this.SHEET_ID}/export?format=csv&gid=1`
      },
      {
        name: 'CSV Export (Sheet2, gid=2, public sharing)',
        url: `https://docs.google.com/spreadsheets/d/${this.SHEET_ID}/export?format=csv&gid=2&usp=sharing`
      },
      {
        name: 'CSV Export (Sheet2, gid=2)',
        url: `https://docs.google.com/spreadsheets/d/${this.SHEET_ID}/export?format=csv&gid=2`
      },
      {
        name: 'CSV Export (Sheet2, gid=0, public sharing)',
        url: `https://docs.google.com/spreadsheets/d/${this.SHEET_ID}/export?format=csv&gid=0&usp=sharing`
      },
      {
        name: 'CSV Export (Sheet2, gid=0)',
        url: `https://docs.google.com/spreadsheets/d/${this.SHEET_ID}/export?format=csv&gid=0`
      },
      // 시트명으로 직접 접근 시도
      {
        name: 'CSV Export (Sheet2 by name, public sharing)',
        url: `https://docs.google.com/spreadsheets/d/${this.SHEET_ID}/export?format=csv&sheet=Sheet2&usp=sharing`
      },
      {
        name: 'CSV Export (Sheet2 by name)',
        url: `https://docs.google.com/spreadsheets/d/${this.SHEET_ID}/export?format=csv&sheet=Sheet2`
      },
      {
        name: 'CSV Export (시트2 by name, public sharing)',
        url: `https://docs.google.com/spreadsheets/d/${this.SHEET_ID}/export?format=csv&sheet=시트2&usp=sharing`
      },
      {
        name: 'CSV Export (시트2 by name)',
        url: `https://docs.google.com/spreadsheets/d/${this.SHEET_ID}/export?format=csv&sheet=시트2`
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
        console.log('📄 응답 데이터 (처음 1000자):', text.substring(0, 1000));
        
        // 빈 응답 체크
        if (!text.trim()) {
          console.log('⚠️ 빈 응답 데이터');
          continue;
        }
        
        // 헤더 확인
        const firstLine = text.split('\n')[0];
        console.log('📋 첫 번째 라인 (헤더):', firstLine);
        
        const problems = this.parseCsvSentenceData(text);
        console.log(`✅ ${method.name}로 로드된 문장 문제 수:`, problems.length);
        
        if (problems.length > 0) {
          console.log('📝 첫 번째 문제:', problems[0]);
          return problems;
        } else {
          console.log('⚠️ 파싱된 문제가 없습니다. 원본 데이터를 확인해보세요.');
          console.log('📄 전체 응답 데이터:', text);
        }
      } catch (error) {
        console.error(`❌ ${method.name} 실패:`, error);
      }
    }

    console.error('❌ 모든 구글 시트 접근 방법 실패');
    return [];
  }

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

  private static parseSentenceData(values: string[][]): SentenceProblem[] {
    if (!values || values.length < 2) {
      console.warn('⚠️ 구글 시트 문장 데이터가 비어있습니다.');
      return [];
    }

    const [, ...rows] = values; // headers 변수 제거
    const problems: SentenceProblem[] = [];

    rows.forEach((row, index) => {
      if (row.length >= 6) {
        try {
          const targetWordsJson = row[4]?.trim() || '[]';
          const targetWords = JSON.parse(targetWordsJson);
          
          const levelValue = row[6]?.trim().toUpperCase() || 'BEGINNER';
          const validLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' = 
            ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].includes(levelValue) 
              ? levelValue as 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
              : 'BEGINNER';

          problems.push({
            id: row[0]?.trim() || `sentence_${index + 1}`,
            koreanSentence: row[1]?.trim() || '',
            englishSentence: row[2]?.trim() || '',
            source: row[3]?.trim() || '',
            targetWords: Array.isArray(targetWords) ? targetWords : [],
            wordCount: parseInt(row[5]?.trim()) || 0,
            level: validLevel
          });
        } catch (error) {
          console.warn(`⚠️ 문장 문제 ${index + 1} 파싱 실패:`, error);
        }
      }
    });

    return problems.filter(problem => 
      problem.koreanSentence && 
      problem.englishSentence && 
      problem.targetWords.length > 0
    );
  }

  private static parseCsvSentenceData(csvText: string): SentenceProblem[] {
    console.log('🔧 CSV 문장 데이터 파싱 시작...');
    const lines = csvText.split('\n').filter(line => line.trim());
    console.log('📄 총 라인 수:', lines.length);
    console.log('📋 첫 번째 라인 (헤더):', lines[0]);
    
    if (lines.length < 2) {
      console.warn('⚠️ 데이터 라인이 부족합니다.');
      return [];
    }

    const problems: SentenceProblem[] = [];
    const [, ...rows] = lines; // 헤더 제거
    console.log('📊 데이터 라인 수:', rows.length);

    rows.forEach((line, index) => {
      console.log(`🔍 라인 ${index + 1} 파싱:`, line);
      
      // CSV 파싱 (쉼표로 분리, 따옴표 처리)
      const columns = this.parseCsvLine(line);
      console.log(`📝 파싱된 컬럼들:`, columns);
      
      if (columns.length >= 6 && columns[1].trim() && columns[2].trim()) {
        try {
          const targetWordsJson = columns[4]?.trim() || '[]';
          const targetWords = JSON.parse(targetWordsJson);
          
          const levelValue = columns[6]?.trim().toUpperCase() || 'BEGINNER';
          const validLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' = 
            ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].includes(levelValue) 
              ? levelValue as 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
              : 'BEGINNER';

          const problem: SentenceProblem = {
            id: columns[0]?.trim() || `sentence_${index + 1}`,
            koreanSentence: columns[1]?.trim() || '',
            englishSentence: columns[2]?.trim() || '',
            source: columns[3]?.trim() || '',
            targetWords: Array.isArray(targetWords) ? targetWords : [],
            wordCount: parseInt(columns[5]?.trim()) || 0,
            level: validLevel
          };
          
          problems.push(problem);
          console.log(`✅ 문장 문제 추가됨:`, problem);
        } catch (error) {
          console.warn(`⚠️ 라인 ${index + 1} JSON 파싱 실패:`, error);
        }
      } else {
        console.log(`⚠️ 라인 ${index + 1} 건너뜀 - 유효하지 않은 데이터`);
      }
    });

    const validProblems = problems.filter(problem => 
      problem.koreanSentence && 
      problem.englishSentence && 
      problem.targetWords.length > 0
    );
    console.log('🎯 최종 유효한 문장 문제 수:', validProblems.length);
    return validProblems;
  }

  private static parseSheetData(values: string[][]): Word[] {
    if (!values || values.length < 2) {
      console.warn('⚠️ 구글 시트 데이터가 비어있습니다.');
      return [];
    }

    const [headers, ...rows] = values;
    
    // 헤더에서 출처 컬럼 인덱스 찾기
    const findSourceColumnIndex = (headers: string[]): number => {
      const sourceKeywords = ['출처', 'source', 'Source', 'SOURCE', '출전', '원본'];
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i]?.trim().toLowerCase();
        if (sourceKeywords.some(keyword => header.includes(keyword.toLowerCase()))) {
          return i;
        }
      }
      // 출처 컬럼을 찾지 못하면 D열(인덱스 3) 또는 마지막 컬럼 사용
      return headers.length > 3 ? 3 : headers.length - 1;
    };
    
    const sourceColumnIndex = findSourceColumnIndex(headers);
    console.log(`📋 출처 컬럼 인덱스: ${sourceColumnIndex} (헤더: ${headers[sourceColumnIndex]})`);
    
    const words: Word[] = [];

    rows.forEach((row, index) => {
      if (row.length >= 2) {
        const source = row[sourceColumnIndex]?.trim() || undefined;
        words.push({
          id: `word_${index + 1}`,
          english: this.removePartOfSpeech(row[0]?.trim() || ''),
          korean: row[1]?.trim() || '',
          imageUrl: row[2]?.trim() || undefined,
          category: source, // 출처를 카테고리로 사용
          pronunciation: undefined,
          example: undefined,
          difficulty: undefined
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

    // 헤더 파싱
    const headerLine = lines[0];
    const headerColumns = this.parseCsvLine(headerLine);
    
    // 헤더에서 출처 컬럼 인덱스 찾기
    const findSourceColumnIndex = (headers: string[]): number => {
      const sourceKeywords = ['출처', 'source', 'Source', 'SOURCE', '출전', '원본'];
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i]?.trim().toLowerCase();
        if (sourceKeywords.some(keyword => header.includes(keyword.toLowerCase()))) {
          return i;
        }
      }
      // 출처 컬럼을 찾지 못하면 D열(인덱스 3) 또는 마지막 컬럼 사용
      return headers.length > 3 ? 3 : headers.length - 1;
    };
    
    const sourceColumnIndex = findSourceColumnIndex(headerColumns);
    console.log(`📋 출처 컬럼 인덱스: ${sourceColumnIndex} (헤더: ${headerColumns[sourceColumnIndex]})`);

    const words: Word[] = [];
    const [, ...rows] = lines; // 헤더 제거
    console.log('📊 데이터 라인 수:', rows.length);

    rows.forEach((line, index) => {
      console.log(`🔍 라인 ${index + 1} 파싱:`, line);
      
      // CSV 파싱 (쉼표로 분리, 따옴표 처리)
      const columns = this.parseCsvLine(line);
      console.log(`📝 파싱된 컬럼들:`, columns);
      
      if (columns.length >= 2 && columns[0].trim() && columns[1].trim()) {
        const source = columns[sourceColumnIndex]?.trim() || undefined;
        const word: Word = {
          id: `word_${index + 1}`,
          english: this.removePartOfSpeech(columns[0]?.trim() || ''),
          korean: columns[1]?.trim() || '',
          imageUrl: columns[2]?.trim() || undefined,
          category: source, // 출처를 카테고리로 사용
          pronunciation: undefined,
          example: undefined,
          difficulty: undefined
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

    // 헤더 파싱
    const headerLine = lines[0];
    const headerColumns = headerLine.split('\t').map(col => col.trim());
    
    // 헤더에서 출처 컬럼 인덱스 찾기
    const findSourceColumnIndex = (headers: string[]): number => {
      const sourceKeywords = ['출처', 'source', 'Source', 'SOURCE', '출전', '원본'];
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i]?.trim().toLowerCase();
        if (sourceKeywords.some(keyword => header.includes(keyword.toLowerCase()))) {
          return i;
        }
      }
      // 출처 컬럼을 찾지 못하면 D열(인덱스 3) 또는 마지막 컬럼 사용
      return headers.length > 3 ? 3 : headers.length - 1;
    };
    
    const sourceColumnIndex = findSourceColumnIndex(headerColumns);
    console.log(`📋 출처 컬럼 인덱스: ${sourceColumnIndex} (헤더: ${headerColumns[sourceColumnIndex]})`);

    const words: Word[] = [];
    const [, ...rows] = lines; // 헤더 제거
    console.log('📊 데이터 라인 수:', rows.length);

    rows.forEach((line, index) => {
      console.log(`🔍 라인 ${index + 1} 파싱:`, line);
      
      // TSV 파싱 (탭으로 분리)
      const columns = line.split('\t').map(col => col.trim());
      console.log(`📝 파싱된 컬럼들:`, columns);
      
      if (columns.length >= 2 && columns[0] && columns[1]) {
        const source = columns[sourceColumnIndex] || undefined;
        const word: Word = {
          id: `word_${index + 1}`,
          english: this.removePartOfSpeech(columns[0] || ''),
          korean: columns[1] || '',
          imageUrl: columns[2] || undefined,
          category: source, // 출처를 카테고리로 사용
          pronunciation: undefined,
          example: undefined,
          difficulty: undefined
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

  // 영어 단어에서 품사를 제거하는 함수
  public static removePartOfSpeech(englishWord: string): string {
    if (!englishWord) return '';
    
    console.log(`🔍 품사 제거 전: "${englishWord}"`);
    
    // 괄호 안의 품사 제거 (예: "apple (n.)" -> "apple")
    const withoutParentheses = englishWord.replace(/\s*\([^)]*\)\s*$/, '');
    console.log(`🔍 괄호 제거 후: "${withoutParentheses}"`);
    
    // 마지막에 오는 품사 표시 제거 (예: "apple n." -> "apple")
    const withoutPartOfSpeech = withoutParentheses.replace(/\s+(n\.|v\.|adj\.|adv\.|prep\.|conj\.|interj\.|pron\.|det\.|num\.|art\.)$/i, '');
    console.log(`🔍 축약형 품사 제거 후: "${withoutPartOfSpeech}"`);
    
    // 추가적인 품사 표시 제거 (예: "apple noun" -> "apple")
    const withoutFullPartOfSpeech = withoutPartOfSpeech.replace(/\s+(noun|verb|adjective|adverb|preposition|conjunction|interjection|pronoun|determiner|number|article)$/i, '');
    console.log(`🔍 전체형 품사 제거 후: "${withoutFullPartOfSpeech}"`);
    
    const result = withoutFullPartOfSpeech.trim();
    console.log(`✅ 최종 결과: "${result}"`);
    
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
