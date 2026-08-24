import { describe, expect, it } from "vitest";
import { composeKorean } from "./korean-composer.ts";

// For all of the tests, do refer to https://github.com/dzikoysk/khangul/blob/main/khangul/src/commonTest/kotlin/HangulContextTest.kt
describe("Korean Composition", () => {
    describe("Basic syllable formation", () => {
        it("should compose ㅅ + ㅐ = 새", () => {
            const result = composeKorean("ㅅ", "ㅐ");
            expect(result.text).toBe("새");
        });

        it("should compose ㅅ + ㅐ + ㅅ = 샛", () => {
            let result = composeKorean("ㅅ", "ㅐ");
            result = composeKorean(result.text, "ㅅ");
            expect(result.text).toBe("샛");
        });

        it("should compose ㅅ + ㅐ + ㅅ + ㅐ = 새새", () => {
            let result = composeKorean("ㅅ", "ㅐ");
            result = composeKorean(result.text, "ㅅ");
            result = composeKorean(result.text, "ㅐ");
            expect(result.text).toBe("새새");
        });

        it("should compose ㅅ + ㅛ + ㅅ = 숏", () => {
            let result = composeKorean("ㅅ", "ㅛ");
            result = composeKorean(result.text, "ㅅ");
            expect(result.text).toBe("숏");
        });
    });

    describe("Consonant splitting", () => {
        it("should split final consonant when vowel follows", () => {
            // ㄱ + ㅏ = 가
            let result = composeKorean("ㄱ", "ㅏ");
            expect(result.text).toBe("가");

            // 가 + ㄴ = 간
            result = composeKorean(result.text, "ㄴ");
            expect(result.text).toBe("간");

            // 간 + ㅏ = 가나
            result = composeKorean(result.text, "ㅏ");
            expect(result.text).toBe("가나");
        });
    });

    describe("Multiple syllables", () => {
        it("should handle 한글 composition", () => {
            let result = composeKorean("", "ㅎ");
            result = composeKorean(result.text, "ㅏ");
            result = composeKorean(result.text, "ㄴ");
            result = composeKorean(result.text, "ㄱ");
            result = composeKorean(result.text, "ㅡ");
            result = composeKorean(result.text, "ㄹ");
            expect(result.text).toBe("한글");
        });

        it("should handle 민화 composition", () => {
            let result = composeKorean("", "ㅁ");
            result = composeKorean(result.text, "ㅣ");
            result = composeKorean(result.text, "ㄴ");
            result = composeKorean(result.text, "ㅎ");
            result = composeKorean(result.text, "ㅗ");
            result = composeKorean(result.text, "ㅏ");
            expect(result.text).toBe("민화");
        });
    });

    describe("Edge cases", () => {
        it("should handle double consonants starting new syllables", () => {
            // ㅃ can only be initial, not final
            let result = composeKorean("ㅅ", "ㅐ");
            result = composeKorean(result.text, "ㅃ");
            expect(result.text).toBe("새ㅃ");
        });

        it("should compose ㅅ + ㅣ + ㄱ + ㅅ = 싟 (double final consonant)", () => {
            let result = composeKorean("", "ㅅ");
            result = composeKorean(result.text, "ㅣ");
            result = composeKorean(result.text, "ㄱ");
            result = composeKorean(result.text, "ㅅ");
            expect(result.text).toBe("싟");
        });

        it("should compose ㅇ + ㅗ + ㅏ + ㄴ = 완 (compound medial vowel)", () => {
            let result = composeKorean("", "ㅇ");
            result = composeKorean(result.text, "ㅗ");
            result = composeKorean(result.text, "ㅏ");
            result = composeKorean(result.text, "ㄴ");
            expect(result.text).toBe("완");
        });
    });

    describe("Progressive letter-by-letter composition: 안녕하세요", () => {
        it("should progressively convert composable letters into hangul syllables", () => {
            let result = composeKorean("", "ㅇ");
            expect(result.text).toBe("ㅇ");

            result = composeKorean(result.text, "ㅏ");
            expect(result.text).toBe("아");

            result = composeKorean(result.text, "ㄴ");
            expect(result.text).toBe("안");

            result = composeKorean(result.text, "ㄴ");
            expect(result.text).toBe("안ㄴ");

            result = composeKorean(result.text, "ㅕ");
            expect(result.text).toBe("안녀");

            result = composeKorean(result.text, "ㅇ");
            expect(result.text).toBe("안녕");

            result = composeKorean(result.text, "ㅎ");
            expect(result.text).toBe("안녕ㅎ");

            result = composeKorean(result.text, "ㅏ");
            expect(result.text).toBe("안녕하");

            result = composeKorean(result.text, "ㅅ");
            expect(result.text).toBe("안녕핫");

            result = composeKorean(result.text, "ㅔ");
            expect(result.text).toBe("안녕하세");

            result = composeKorean(result.text, "ㅇ");
            expect(result.text).toBe("안녕하셍");

            result = composeKorean(result.text, "ㅛ");
            expect(result.text).toBe("안녕하세요");
        });
    });
});
