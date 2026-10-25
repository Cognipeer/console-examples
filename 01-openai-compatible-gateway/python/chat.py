from client import MODEL, client, describe_error

try:
    res = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": "You are a concise assistant."},
            {"role": "user", "content": "What is the capital of France?"},
        ],
        temperature=0.2,
    )
    print(res.choices[0].message.content)
    print("usage:", res.usage)
except Exception as err:  # noqa: BLE001
    raise SystemExit(describe_error(err))
