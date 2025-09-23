# Literals (Pipeline)

# Pipelines and Literals

Pipelines let you wire outputs from earlier ops into the inputs of later ones without hardcoding values. You do this by placing string literals inside any `args` field. At runtime, the TaskManager interpolates those literals against its global store and returns a new `Operation<T>` with `args` fully substituted. Only `args` are modified; `type`, `id`, and `results` are preserved.

A literal is any substring wrapped in double percent markers that points to a value in the TaskManager store. The two most common forms are:

- `%%ops.<opId>.results.<key>%%` → fetches a key from the `results` map of another op.
- `%%ops.<opId>.host%%` → resolves the runtime hostname of another op.

Interpolation happens when an operation is hydrated, just before it is scheduled to run. Unresolved literals throw errors.

This is the key rule: **a literal is only guaranteed to resolve if the producing op is in the same group and is listed in `depends_on` or has ran and completed successfully.**

# Results, Resources, and Dynamic Interpolation

Ops don’t have to be static. With results and literals, you can turn one op’s output into another’s input, dynamically shaping images, commands, resources, or environment variables.

## Results Extraction

An op can define a `results` block that tells the TaskManager how to extract structured values from its logs. You give each result a key, and either a regex string or an object describing a regex plus log types to scan.

For example:

```jsx
{
  "type": "container/run",
  "id": "hello-world",
  "args": {
    "cmd": [
      "-c",
      "echo running ubuntu;",
      "echo Device 0: NVIDIA GeForce RTX 3070, compute capability 8.6, VMM: yes >>/dev/stderr;",
      "echo Device 1: NVIDIA GeForce RTX 3080, compute capability 8.6, VMM: yes"
    ],
    "entrypoint": ["sh"],
    "image": "ubuntu"
  },
  "results": {
    "detected-gpu-stderr": {
      "regex": "Device [0-9].*",
      "logType": ["stderr"]
    },
    "detected-gpu-all-std": "Device [0-9].*",
    "empty-result": "Missing",
    "throw-error": {
      "regex": "\\",
      "logType": ["stdout", "stderr"]
    }
  }
}

```

Here, GPU device strings are captured as results. Later ops can reference them via literals like:

```json
"cmd": ["--gpus", "%%ops.hello-world.results.detected-gpu-stderr%%"]
```

## Resources

Ops can mount resources such as S3 buckets, volumes, or secrets. Static example:

```json
{
  "type": "container/run",
  "id": "ollama",
  "args": {
    "cmd": [],
    "image": "docker.io/ollama/ollama",
    "gpu": true,
    "expose": 11434,
    "resources": [
      {
        "type": "S3",
        "url": "s3://nos-ai-models-qllsn32u/ollama/llama3.1/70b",
        "target": "/root/.ollama/models"
      }
    ]
  }
}

```

But resources don’t have to be hardcoded. You can dynamically build the `url` or `target` fields using literals from prior ops.

Example:

```json
"resources": [
  {
    "type": "S3",
    "url": "s3://nos-ai-models/%%ops.model-finder.results.bucket_path%%",
    "target": "/root/.ollama/models"
  }
]
```

This lets you fetch models, weights, or configs discovered earlier in the pipeline.

## Dynamic Images and Commands

The same literal system applies to container images and commands. You can resolve which image to run, or which CLI args to pass, from earlier results.

Dynamic image:

```json
"image": "%%ops.resolver.results.image%%"
```

Dynamic command:

```json
"cmd": ["run", "%%ops.seed.results.task_id%%"]
```

Since interpolation happens at hydration time, the op won’t start until all its dependencies are satisfied and its literals can be resolved.

## Putting It All Together

Here’s a pipeline that turns a generated story into a cover image and a short video, then ships everything to S3 .

It starts with the story stage. That stage has a single op that actually generates the story. When it finishes, it writes three results: a title, a body, and a slug. Because groups are stages and only one stage runs at a time, the next stage doesn’t begin until this story stage is done.

The media stage comes next and runs two ops in parallel: one creates a cover image, the other renders a short video. Neither declares a dependency on the story op, because dependencies are only allowed within the same group. They don’t need to anyway. The story stage has already finished, so both media ops can safely pull `%%ops.story.results.title%%` and `%%ops.story.results.body%%` as literals at hydration time.

Once both media ops complete, the download stage runs. It has one op that mounts your target S3 path for example `s3://my-bucket/stories/%%ops.story.results.slug%%` and uploads three things: the story payload (built from the title and body), the cover image produced by the image op, and the video produced by the video op. All three are wired by literals reading each producer’s `results` .

That’s the flow: one stage per group, strict stage ordering, parallelism inside the media stage, and all cross-stage data passed by results and resolved with literals. If you need to retry a flaky render, restart the specific media op. If you need a clean re-run of media, restart the media group. If you stop a media op, its producers are unaffected, and the download stage won’t begin until the media stage has fully finished.

```json
{
  "version": "0.1",
  "type": "container",
  "meta": { "trigger": "cli" },
  "ops": [
    {
      "type": "container/run",
      "id": "story",
      "args": {
        "image": "docker.io/ai-tools/story-gen:latest",
        "cmd": [
          "--length", "short",
          "--theme", "fantasy"
        ]
      },
      "results": {
        "title": "title=.*",
        "body": "body=.*",
        "slug": "slug=.*"
      },
      "execution": { "group": "story" }
    },

    {
      "type": "container/run",
      "id": "image",
      "args": {
        "image": "docker.io/ai-tools/image-gen:latest",
        "cmd": [
          "--prompt",
          "Cover image for %%ops.story.results.title%%"
        ]
      },
      "results": {
        "cover_path": ".*\\.png"
      },
      "execution": { "group": "media", "depends_on": ["story"] }
    },

    {
      "type": "container/run",
      "id": "video",
      "args": {
        "image": "docker.io/ai-tools/video-gen:latest",
        "cmd": [
          "--script",
          "%%ops.story.results.body%%",
          "--title",
          "%%ops.story.results.title%%"
        ]
      },
      "results": {
        "video_path": ".*\\.mp4"
      },
      "execution": { "group": "media", "depends_on": ["story"] }
    },

    {
      "type": "container/run",
      "id": "download",
      "args": {
        "image": "docker.io/library/alpine",
        "entrypoint": ["sh"],
        "cmd": [
          "-c",
          "echo Uploading story=%%ops.story.results.title%%; " ,
          "echo Uploading cover=%%ops.image.results.cover_path%%; " ,
          "echo Uploading video=%%ops.video.results.video_path%%"
        ],
        "resources": [
          {
            "type": "S3",
            "url": "s3://my-bucket/stories/%%ops.story.results.slug%%",
            "target": "/upload"
          }
        ]
      },
      "results": {
        "dest": "uploaded=.*"
      },
      "execution": { "group": "download", "depends_on": ["image", "video"] }
    }
  ]
}
```

# Collection Operators

Collection operators are **special keys** that appear inside JSON configs.

They are transformed by the TaskManager *before* literal interpolation (`%%…%%`).

Each operator follows the same rules:

- It has a reserved key name (e.g. `__spread__`).
- It may define both an **array handler** and an **object handler**.
- During the `transformCollections` pass, the operator is replaced by regular JSON values.
- After transformation, no operator keys remain — only normal JSON objects and arrays.

This makes collections **extensible**: new operators can be added without changing how pipelines are defined.

---

## `__spread__`

Expands the contents of an array or object inline.

- **Array mode** → splices array items into the parent array.
- **Object mode** → merges object fields into the parent object.

**Before (array mode)**

```json
"expose": [
  5000,
  { "__spread__": "[7000,8000,9000]" },
  6000
]

```

**After**

```json
"expose": [5000, 7000, 8000, 9000, 6000]

```

**Before (object mode)**

```json
{
  "env": {
    "STATIC_KEY": "static_value",
    "__spread__": "{\"IMAGE_NAME\":\"ubuntu\",\"IMAGE_TAG\":\"20.04\"}"
  }
}

```

**After**

```json
{
  "env": {
    "STATIC_KEY": "static_value",
    "IMAGE_NAME": "ubuntu",
    "IMAGE_TAG": "20.04"
  }
}

```

---

## `__pairs__`

Converts an array of `{ key, value }` objects into direct fields on the parent.

**Before**

```json
{
  "env": {
    "STATIC_KEY": "static_value",
    "__pairs__": "[{\"key\":\"IMAGE_NAME\",\"value\":\"ubuntu\"},{\"key\":\"IMAGE_TAG\",\"value\":\"20.04\"}]"
  }
}

```

**After**

```json
{
  "env": {
    "STATIC_KEY": "static_value",
    "IMAGE_NAME": "ubuntu",
    "IMAGE_TAG": "20.04"
  }
}

```

---

## Adding More Operators

Because operators are just entries in `DefaultCollectionMarkers`, you can define additional ones.

For example, you could add `__concat__`, `__map__`, or `__switch__`.

Each new operator should come with:

- A short description of its purpose.
- Rules for how its array and object handlers behave.
- A **before/after** JSON example.

# Array-Aware Interpolation

Interpolation now supports **arrays and structured values**, not just primitive strings.

The TaskManager automatically normalizes the resolved value based on the **shape of the original field** in your op definition.

---

## How It Works

- If the original field is a **string** → arrays are flattened and joined into a single space-separated string.
- If the original field is an **array** → arrays are flattened into the parent array.
- If the original field is an **object** → each field is normalized recursively.
- If the original field is a **primitive** → the resolved value is passed through as-is.

This means you don’t have to hand-convert arrays to strings. The system “does the right thing” based on context.

---

## Examples

### Interpolating into an array

**Before**

```json
{
  "cmd": ["%%ops.result.arr%%", 2, 1]
}

```

**Given**

```json
{
  "ops": {
    "result": {
      "results": {
        "arr": [4, 3]
      }
    }
  }
}

```

**After**

```json
{
  "cmd": [4, 3, 2, 1]
}

```

---

### Interpolating into a string

**Before**

```json
{
  "cmd": "%%ops.result.arr%%"
}

```

**Given**

```json
{
  "ops": {
    "result": {
      "results": {
        "arr": [4, 3]
      }
    }
  }
}

```

**After**

```json
{
  "cmd": "4 3"
}

```

---

## Why This Matters

- **Cleaner pipelines**: No need to manually `join` arrays in shell scripts.
- **Safer defaults**: Arrays stay arrays if the field is an array, and become strings if the field is a string.
- **Recursive normalization**: Works the same way for deeply nested objects or arrays.