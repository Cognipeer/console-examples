from client import MODEL, client, describe_error

try:
    stream = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": "Write a two-sentence story about a lighthouse."}],
        stream=True,
    )
    for chunk in stream:
        if chunk.choices:
            print(chunk.choices[0].delta.content or "", end="", flush=True)
    print()
except Exception as err:  # noqa: BLE001
    print()  # end the line of text that was already printed
    raise SystemExit(describe_error(err))
