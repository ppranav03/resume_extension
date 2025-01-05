from openai import OpenAI

client = OpenAI(
  api_key="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"
)

completion = client.chat.completions.create(
  model="gpt-4o-mini",
  store=True,
  messages=[
    {"role": "user", "content": "write a haiku about ai"}
  ]
)

print(completion.choices[0].message);
