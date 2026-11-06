# Fine-Tuning Guide: Text-to-Floor-Plan Model (Beginner Edition)

> Companion to `text-to-cad-project-memory.md`. Written for a non-programmer. Every code block is copy-paste. If anything shows a red error, copy the whole error into a Claude chat with this file attached.
> **Version:** 1.2 · **Date:** 31 Oct 2026, updated 5 Nov 2026 (matches `PRD.md` v1.2: all sizes in **cm**, real run uses the engine's **Brief** format).

---

## 0. The big picture (read once)

- **We do not upload pictures.** The model reads and writes **text**. Each floor plan is converted into structured text (JSON).
- **We teach by example.** Each training example is a pair: *request* ("3BHK, 30×40, east facing, Vastu") → *answer* (that plan's JSON).
- **Nothing runs on your laptop.** Training happens on **Google Colab**, a website that lends you a powerful computer (GPU) inside your browser.
- **"Downloading the model"** happens automatically inside Colab with one line of code. You never download a large file yourself.
- **LoRA** means we don't change the whole model, only add a small "adapter" (≈100–300 MB) that holds your design knowledge. That's why it's cheap.

### The journey
```
Your DWG files → DXF → plan JSON → training pairs (train.jsonl / test.jsonl)
      → Google Colab → load Qwen → test BEFORE → train → test AFTER
      → compare scores → save privately to Hugging Face
```

### Two runs
| Run | Plans | Purpose |
|---|---|---|
| **Practice run** | 200 | Learn the process. Expect memorising, not real skill. |
| **Real run** | 1,000+ | Build a useful model. |

---

## 1. One-time setup (≈30 minutes)

### 1.1 Google account
You probably have one. It gives you **Google Drive** (storage) and **Google Colab** (free GPU).

### 1.2 Hugging Face account and access key
1. Go to huggingface.co → **Sign Up** (free).
2. Click your profile picture → **Settings** → **Access Tokens** → **Create new token**.
3. Type: **Write**. Name: `colab-training`. Click **Create**.
4. Copy the token (starts with `hf_`). Treat it like a password: never share it or paste it into chats or documents.

### 1.3 Folder in Google Drive
Create this folder structure in Drive:
```
MyDrive/
  floorplan-ai/
    data/        ← train.jsonl and test.jsonl go here
    outputs/     ← trained model and results get saved here
```

### 1.4 Optional: Colab Pro
The free Colab GPU (T4) works for the practice run with a smaller model. For the real run, Colab Pro (monthly subscription) gives faster GPUs (L4/A100) and longer sessions. Alternatives: RunPod, Vast.ai, E2E Networks.

---

## 2. Prepare the data (the most important step)

### 2.1 Convert drawings to plan JSON
- DWG → DXF with the free **ODA File Converter**.
- DXF → plan document with **the engine's importer** (PRD P1.2).
- Remove client names, addresses and site details.
- Result: one `.json` file per plan, e.g. `plan_001.json`.
- The engine's **dataset export** (PRD P8.2) writes `train.jsonl` / `test.jsonl` for you, in the formats below. All sizes are in **centimetres**.

### 2.2 What one training example looks like
**Practice format (practice run only):** rooms as rectangles in cm. Each line of `train.jsonl` is one example:
```json
{"plan_id": "plan_001", "messages": [
  {"role": "system", "content": "You are a residential floor plan generator. Reply with plan JSON only."},
  {"role": "user", "content": "3BHK on a 30x40 ft east-facing plot, ground floor, Vastu-compliant kitchen, parking in front."},
  {"role": "assistant", "content": "{\"plot\": {\"width_cm\": 914, \"depth_cm\": 1219, \"facing\": \"east\"}, \"rooms\": [{\"type\": \"living\", \"x\": 90, \"y\": 150, \"w\": 420, \"h\": 480}, ...]}"}
]}
```
(In the real file each example is on **one single line**.)

**Graph format (real run, recommended):** the answer is the engine's **Brief** (PRD §4.6): the room list and how rooms connect (sizes in cm and m²). The engine's solver then draws the exact plan.
```json
{"plot": {"width_cm": 914, "depth_cm": 1219, "road_facing": "east"},
 "bhk": 3, "floors": 1, "vastu": true, "parking": 1,
 "rooms": [{"id": "living", "type": "living", "target_m2": 16},
           {"id": "kitchen", "type": "kitchen", "target_m2": 7.5},
           {"id": "bedroom-1", "type": "master_bedroom", "target_m2": 12}],
 "adjacency": [{"a": "kitchen", "b": "living", "rel": "door", "strength": "must"}]}
```
The practice format is fine for learning the process. Use the graph format for the real run: it needs far fewer plans to learn, and its output goes straight into the engine.

### 2.3 Generate several requests per plan
Our pairing script writes 3–5 different requests per plan from its tags, e.g.:
- "3BHK east facing 30x40"
- "Three-bedroom house, 30 by 40 feet plot, road on the east"
- "30x40 east facing Vastu house with 3 bedrooms and car parking"

### 2.4 Split into train and test, BY PLAN
- Put **85–90% of plans** in `train.jsonl` and **10–15%** in `test.jsonl`.
- ⚠️ All phrasings of the same plan must go to the **same** file. Otherwise the test is "cheating": the model has already seen that plan.
- Test plans should cover a mix of plot sizes, facings and BHKs.

### 2.5 Augmentation (real run)
Mirror and rotate plans to create more examples. ⚠️ Update **facing** and **Vastu** labels after every mirror or rotation.

Upload `train.jsonl` and `test.jsonl` to `MyDrive/floorplan-ai/data/`.

---

## 3. Open Colab and connect

1. Go to colab.research.google.com → **New notebook**.
2. Menu **Runtime → Change runtime type → T4 GPU** (or L4/A100 on Pro) → **Save**.
3. A notebook is a list of **cells**. Paste code into a cell and press **▶** (or Shift+Enter). Run cells in order, top to bottom.
4. If Colab disconnects, run all cells again from the top (your files in Drive are safe).

> **Tip:** Unsloth (the training tool we use) publishes ready-made Colab notebooks for Qwen on its GitHub/website. If the cells below show errors because the tool has been updated, open the official Unsloth Qwen notebook and replace only its "data" cells with ours.

### Cell 1: Install tools (≈2–3 min)
```python
!pip install unsloth
```

### Cell 2: Connect Google Drive
```python
from google.colab import drive
drive.mount('/content/drive')
DATA = '/content/drive/MyDrive/floorplan-ai/data'
OUT  = '/content/drive/MyDrive/floorplan-ai/outputs'
```
Click **Allow** when asked.

### Cell 3: Log in to Hugging Face
```python
from huggingface_hub import login
login()   # a box appears: paste your hf_ token there, not in the code
```

---

## 4. Load the model (the "download")

### Cell 4
```python
from unsloth import FastLanguageModel

MODEL = "unsloth/Qwen3-4B"   # practice run on free T4
# MODEL = "unsloth/Qwen3-8B" # real run on L4/A100

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name = MODEL,
    max_seq_length = 4096,   # long enough for one plan JSON
    load_in_4bit = True,     # compressed so it fits the GPU
)
```
This downloads the model from Hugging Face into Colab (a few GB, a few minutes).

---

## 5. Load your data

### Cell 5
```python
from datasets import load_dataset

ds = load_dataset("json", data_files={
    "train": f"{DATA}/train.jsonl",
    "test":  f"{DATA}/test.jsonl",
})

def to_text(example):
    return {"text": tokenizer.apply_chat_template(
        example["messages"], tokenize=False, enable_thinking=False)}

train_ds = ds["train"].map(to_text)
test_ds  = ds["test"].map(to_text)
print(len(train_ds), "training examples |", len(test_ds), "test examples")
print(train_ds[0]["text"][:800])   # peek at one example
```

---

## 6. Scoring tools (how we measure learning)

### Cell 6: Checker and scorer
This scorer is for **practice-format** answers (rectangles in cm). Graph answers (Briefs) are scored properly by running them through the engine's solver and checks (PRD P9.2); in Colab, look only at `valid_json`, `bhk_match` and `facing_match` for them.
```python
import json, re

def extract_json(text):
    """Find the plan JSON in the model's reply."""
    m = re.search(r"\{.*\}", text, re.S)
    if not m: return None
    try: return json.loads(m.group(0))
    except Exception: return None

def overlap(a, b):
    return not (a["x"]+a["w"] <= b["x"] or b["x"]+b["w"] <= a["x"] or
                a["y"]+a["h"] <= b["y"] or b["y"]+b["h"] <= a["y"])

def score_plan(plan, request):
    s = {"valid_json": plan is not None}
    if plan is None: return s
    rooms = plan.get("rooms", [])
    W = plan.get("plot", {}).get("width_cm", 0); D = plan.get("plot", {}).get("depth_cm", 0)
    s["inside_plot"] = all(r["x"] >= 0 and r["y"] >= 0 and
                           r["x"]+r["w"] <= W and r["y"]+r["h"] <= D for r in rooms)
    s["no_overlaps"] = not any(overlap(rooms[i], rooms[j])
                               for i in range(len(rooms)) for j in range(i+1, len(rooms)))
    s["min_sizes"] = all(r["w"] >= 240 and r["h"] >= 240 for r in rooms   # cm
                         if "bed" in r.get("type", "").lower())   # adjust to verified rule values
    m = re.search(r"(\d)\s*bhk", request.lower())
    if m:
        beds = sum("bed" in r.get("type", "").lower() for r in rooms)
        s["bhk_match"] = beds == int(m.group(1))
    for f in ["east", "west", "north", "south"]:
        if f in request.lower():
            s["facing_match"] = plan.get("plot", {}).get("facing", "").lower() == f
    return s

def generate(request):
    msgs = [{"role": "system", "content": "You are a residential floor plan generator. Reply with plan JSON only."},
            {"role": "user", "content": request}]
    inp = tokenizer.apply_chat_template(msgs, add_generation_prompt=True,
                                        enable_thinking=False, return_tensors="pt").to("cuda")
    out = model.generate(input_ids=inp, max_new_tokens=2048, temperature=0.7, do_sample=True)
    return tokenizer.decode(out[0][inp.shape[1]:], skip_special_tokens=True)

def evaluate(n=30, label="run"):
    FastLanguageModel.for_inference(model)
    results = []
    for ex in test_ds.select(range(min(n, len(test_ds)))):
        req = ex["messages"][1]["content"]
        reply = generate(req)
        sc = score_plan(extract_json(reply), req)
        results.append({"request": req, "reply": reply, "scores": sc})
    keys = sorted({k for r in results for k in r["scores"]})
    print(f"=== {label} ===")
    for k in keys:
        vals = [r["scores"][k] for r in results if k in r["scores"]]
        print(f"{k:14s}: {100*sum(vals)/len(vals):5.1f}%  ({sum(vals)}/{len(vals)})")
    json.dump(results, open(f"{OUT}/eval_{label}.json", "w"), indent=1)
    return results
```

### Cell 7: Score BEFORE training (baseline)
```python
before = evaluate(n=30, label="before")
```
Expect low scores: the untrained model doesn't know your format.

---

## 7. Train

### Cell 8: Add the LoRA adapter
```python
model = FastLanguageModel.get_peft_model(
    model,
    r = 16, lora_alpha = 16, lora_dropout = 0,
    target_modules = ["q_proj","k_proj","v_proj","o_proj","gate_proj","up_proj","down_proj"],
    use_gradient_checkpointing = "unsloth",
    random_state = 3407,
)
```

### Cell 9: Training settings and start
```python
from trl import SFTTrainer, SFTConfig

FastLanguageModel.for_training(model)
trainer = SFTTrainer(
    model = model,
    tokenizer = tokenizer,
    train_dataset = train_ds,
    eval_dataset = test_ds,
    args = SFTConfig(
        dataset_text_field = "text",
        max_seq_length = 4096,
        per_device_train_batch_size = 2,
        gradient_accumulation_steps = 4,
        num_train_epochs = 3,          # passes through the data
        learning_rate = 2e-4,
        logging_steps = 10,            # print training loss every 10 steps
        eval_strategy = "steps",
        eval_steps = 50,               # print test loss every 50 steps
        optim = "adamw_8bit",
        output_dir = f"{OUT}/checkpoints",
        save_steps = 100,
        seed = 3407,
        report_to = "none",
    ),
)
trainer.train()
```
Practice run: minutes to ~1 hour. Real run: a few hours.

---

## 8. Measure what it learned

### 8.1 Read the loss numbers (during training)
- **Training loss:** how wrong the model is on examples it is learning from. Should go **down**.
- **Test (eval) loss:** how wrong it is on plans it has **never seen**. Should also go **down**.

| What you see | What it means | What to do |
|---|---|---|
| Both go down and level off | Healthy learning ✅ | Done |
| Training ↓ but test ↑ | **Memorising** (overfitting) | Fewer epochs (2 or 1), more data, more augmentation |
| Both stay high | Not learning | Check data format; train longer; bigger model |
| Training loss near 0 | Memorised everything | Expected with 200 plans; need more data |

### Cell 10: Plot the losses
```python
import matplotlib.pyplot as plt
h = trainer.state.log_history
tr = [(x["step"], x["loss"]) for x in h if "loss" in x]
ev = [(x["step"], x["eval_loss"]) for x in h if "eval_loss" in x]
plt.plot(*zip(*tr), label="training loss")
if ev: plt.plot(*zip(*ev), label="test loss")
plt.xlabel("step"); plt.ylabel("loss (lower = better)"); plt.legend(); plt.show()
```

### Cell 11: Score AFTER training
```python
after = evaluate(n=30, label="after")
```
Compare with "before". What we want to see rise:

| Measure | Meaning | Practice-run hope | Real-run target |
|---|---|---|---|
| valid_json | Output is a readable plan | > 90% | > 98% |
| inside_plot | All rooms inside the plot | improving | > 90% |
| no_overlaps | Rooms don't overlap | improving | > 85% |
| bhk_match | Right number of bedrooms | > 70% | > 95% |
| facing_match | Right facing | > 70% | > 95% |
| min_sizes | Bedrooms meet minimum size | improving | > 90% |

(Targets are starting goals; we'll adjust them after the first real results.)

### 8.2 Is it copying? (novelty check)
A model that only copies training plans will score well but be useless. Later we add a script that compares each generated plan with its closest training plan. Too similar means copying. With 200 plans, expect some copying.

### 8.3 Architect review (the most important test)
1. Take 20 test requests.
2. Generate one plan with **your model** and one with your **Gemini setup**.
3. Convert both to drawings (CAD builder), shuffle, and hide which is which.
4. You (and ideally 2–3 other architects) rate each 1–5 on layout logic, circulation, Vastu, buildability.
5. Your model goes live **only if it beats Gemini** here.

---

## 9. Save your model

### Cell 12: Save to Drive and Hugging Face (private)
```python
model.save_pretrained(f"{OUT}/lora-v1")
tokenizer.save_pretrained(f"{OUT}/lora-v1")

HF_USER = "your-hf-username"   # ← change this
model.push_to_hub(f"{HF_USER}/floorplan-lora-v1", private=True)
tokenizer.push_to_hub(f"{HF_USER}/floorplan-lora-v1", private=True)
```
⚠️ Always `private=True`. Your trained model contains your design knowledge.

**After training:** host the model with a service that offers an **OpenAI-compatible API** (vLLM does, as do most hosted-inference services). The editor already talks to Gemini that way, so connecting your model is a settings change: the endpoint address, a key kept in the server's `.env` (never in chat or the frontend), and the model name (PRD P9.1).

### Optional: try it on your laptop
A small model (Qwen3-4B) can be exported to GGUF format and run on your 4 GB GPU laptop with free apps like **LM Studio** or **Ollama**. Unsloth notebooks include an export cell; ask Claude when you reach this stage.

---

## 10. After the first run

- Keep a **run log**: date, model, number of plans, epochs, all scores. Copy scores into `text-to-cad-project-memory.md`.
- Change one thing at a time between runs (more data, fewer epochs, bigger model) so you know what helped.
- Real run checklist: 1,000+ plans · augmentation on · Stage 1 public data (licence-checked) → Stage 2 own plans · Qwen ~8B · architect review vs Gemini.
- Optional later: reinforcement learning with the checker as reward (Mila method).

## 11. Troubleshooting

| Problem | Fix |
|---|---|
| "CUDA out of memory" | Smaller model (4B), `per_device_train_batch_size = 1`, or `max_seq_length = 2048` if plans are short |
| Colab disconnected | Re-run all cells from the top; checkpoints are in Drive |
| Install/import errors | The tool updated; open the official Unsloth Qwen notebook and paste only our data cells |
| Model replies with text instead of JSON | More training examples; check the system message is identical in training and testing |
| Anything else | Paste the full error into a Claude chat with this guide attached |

## Change log
- **v1.2 (5 Nov 2026):** Practice format and scorer switched to cm (`width_cm`, `depth_cm`, min bedroom 240 cm) to match the engine's dataset export; graph format = engine Brief; inline audit marks removed.
- **v1.1 (4 Nov 2026):** Graph target (engine Brief format) and OpenAI-compatible hosting note added.
- **v1 (31 Oct 2026):** First version.
