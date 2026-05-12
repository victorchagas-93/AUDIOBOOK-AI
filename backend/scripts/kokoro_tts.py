import argparse
import json
import sys
from pathlib import Path


def build_parser():
    parser = argparse.ArgumentParser(description="Gera audio pt-BR com Kokoro-82M")
    parser.add_argument("--text-file", required=True, help="Arquivo UTF-8 com o texto de entrada")
    parser.add_argument("--output", required=True, help="Caminho do WAV de saida")
    parser.add_argument("--voice", required=True, help="Voice id do Kokoro")
    parser.add_argument("--lang-code", default="p", help="Lang code do Kokoro/Misaki")
    parser.add_argument("--speed", type=float, default=1.0, help="Velocidade de fala")
    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    try:
        import numpy as np
        import soundfile as sf
        from kokoro import KPipeline
    except ImportError as error:
        missing_name = getattr(error, "name", "dependencia desconhecida")
        raise RuntimeError(
            "Dependencias Python do Kokoro nao instaladas. "
            f"Modulo ausente: {missing_name}. "
            'Instale com: pip install "kokoro>=0.9.4" soundfile "misaki[en]". '
            "No Windows, instale tambem o espeak-ng para pt-BR."
        ) from error

    text_path = Path(args.text_file)
    output_path = Path(args.output)

    if not text_path.exists():
        raise RuntimeError(f"Arquivo de texto nao encontrado: {text_path}")

    text = text_path.read_text(encoding="utf-8").strip()
    if not text:
        raise RuntimeError("Texto vazio para geracao")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    pipeline = KPipeline(lang_code=args.lang_code)
    generator = pipeline(
        text,
        voice=args.voice,
        speed=args.speed,
        split_pattern=r"\n+"
    )

    chunks = []
    sample_rate = 24000

    for _, _, audio in generator:
        if audio is not None and len(audio) > 0:
            chunks.append(audio)

    if not chunks:
        raise RuntimeError("Nenhum bloco de audio foi produzido pelo Kokoro")

    merged_audio = np.concatenate(chunks)
    sf.write(str(output_path), merged_audio, sample_rate)

    payload = {
        "ok": True,
        "voice": args.voice,
        "lang_code": args.lang_code,
        "sample_rate": sample_rate,
        "output": str(output_path),
    }
    print(json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
