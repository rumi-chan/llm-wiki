# llm-wiki

[English](README.md)

Bộ skill để dựng và duy trì **wiki cho từng project**, theo mô hình
[LLM Wiki của Karpathy](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f),
chạy được trên cả **Claude Code** lẫn **Codex**.

Hai chế độ:

| | Chế độ cá nhân (mặc định) | Chế độ nhóm |
|---|---|---|
| Nằm ở | `.wiki/`, repo git riêng, ẩn khỏi repo project | `docs/wiki/`, commit chung với code |
| Ai thấy | chỉ bạn | cả nhóm, kể cả trên GitHub |
| Ai cập nhật | bạn, bằng `wiki-sync` | agent của từng người trong PR của họ (`wiki-update`) + người giữ wiki chạy `wiki-sync` định kỳ |
| Kiểm tra | `wiki-lint` | script + GitHub Actions trên mọi PR, cùng với `wiki-lint` |

Hai chế độ dùng song song được trong cùng project: thông tin cho nhóm vào `docs/wiki/`, ghi chú
riêng vào `.wiki/`.

## Cài đặt

Chọn **một** cách. Cách A dễ nhất; đừng dùng cả A lẫn B cho cùng một agent, nếu không agent sẽ
nhận chỉ dẫn về wiki hai lần.

### Cách A: plugin (khuyên dùng)

Repo này tự là một plugin marketplace, nằm ở [rumi-chan/llm-wiki](https://github.com/rumi-chan/llm-wiki).

**Claude Code**

```
/plugin install llm-wiki --marketplace rumi-chan/llm-wiki
```

hoặc từ terminal: `claude plugin marketplace add rumi-chan/llm-wiki` rồi
`claude plugin install llm-wiki@llm-wiki`. Cập nhật sau này bằng `claude plugin update llm-wiki@llm-wiki`.

Skill của plugin có tiền tố: `/llm-wiki:wiki-init`, `/llm-wiki:wiki-sync`, `/llm-wiki:wiki-update`,
`/llm-wiki:wiki-lint` (nói bằng lời thường cũng được). Plugin dùng một hook `SessionStart` thay cho
việc sửa `CLAUDE.md` toàn cục: khi repo có wiki, hook báo cho agent biết wiki nằm đâu và đang chậm
bao nhiêu commit so với code. Hook cần có `node` trong `PATH`, và không in gì ở repo không có wiki.

**Codex**

```
codex plugin marketplace add rumi-chan/llm-wiki
```

rồi mở `/plugins` trong Codex và cài **llm-wiki**. Codex sẽ yêu cầu bạn xem và tin cậy hook của
plugin trước khi chạy. Nếu hook không chạy được trên Codex của bạn, dùng cách B với `-Target codex`
(skill cộng một khối trong `~/.codex/AGENTS.md`).

### Cách B: script cài đặt

Copy skill vào thư mục skill của agent và thêm một khối ngắn vào file chỉ dẫn toàn cục. Skill giữ tên
ngắn (`/wiki-init`, `$wiki-init`).

```powershell
# Windows (PowerShell)
git clone https://github.com/rumi-chan/llm-wiki ; cd llm-wiki
.\install.ps1
```

```bash
# macOS / Linux / Git Bash
./install.sh
```

Tùy chọn: `-Target claude|codex` (hoặc `--claude` / `--codex`), `-NoHint` / `--no-hint`,
`-Uninstall` / `--uninstall`. Chạy lại bao nhiêu lần cũng được.

| | Claude Code | Codex |
|---|---|---|
| Skill | `~/.claude/skills/wiki-*` | `~/.agents/skills/wiki-*` |
| Chỉ dẫn toàn cục | thêm một khối vào `~/.claude/CLAUDE.md` | thêm một khối vào `~/.codex/AGENTS.md` |

Khối chỉ dẫn toàn cục (giữa `<!-- llm-wiki:begin -->` và `<!-- llm-wiki:end -->`) bảo agent của bạn
đọc `SCHEMA.md` và `index.md` của wiki mà repo đang có. Nhờ vậy wiki cá nhân **không cần file trỏ
nào trong repo**. (Codex không có file tương đương `CLAUDE.local.md`, còn `AGENTS.override.md` sẽ
che mất `AGENTS.md` của team.) Không muốn sửa file toàn cục thì cài với `-NoHint`.

Khởi động lại Claude Code / Codex sau khi cài. Script cài **copy** skill, nên muốn sửa thì sửa
trong repo này rồi chạy lại script cài.

## Các skill

| Skill | Claude Code | Codex | Làm gì |
|---|---|---|---|
| `wiki-init` | `/wiki-init` | `$wiki-init` | Khảo sát project rồi tạo wiki (cá nhân, hoặc nhóm khi nói "team"/"nhóm"/`--shared`) |
| `wiki-sync` | `/wiki-sync` | `$wiki-sync` | Cá nhân: cập nhật wiki theo code. Nhóm: lượt sync định kỳ của người giữ wiki, ra một PR |
| `wiki-update` | `/wiki-update` | `$wiki-update` | Nhóm: sửa các trang bị ảnh hưởng bởi *nhánh của bạn*, trước khi mở PR |
| `wiki-lint` | `/wiki-lint` | `$wiki-lint` | Báo cáo sức khỏe wiki, chỉ đọc; chỉ sửa khi bạn đồng ý |

Hỏi đáp thì cứ hỏi bình thường: schema bảo agent đọc `index.md` trước.

### `wiki-init` chạy **sau khi** project đã có nền

Nó khảo sát project (README, manifest, cây thư mục, entry point, `git log`), phân loại (web, CLI,
firmware Arduino, game mod / RE, pipeline dữ liệu...), **đề xuất các loại trang phù hợp** và hỏi
bạn một lần để xác nhận. Sau đó dựng khung, chỉnh `SCHEMA.md`, và viết 5 đến 12 trang quan trọng
nhất. Project còn gần như trống thì nó dừng lại.

Wiki mặc định viết bằng **tiếng Anh**. Muốn ngôn ngữ khác thì nói lúc chạy `wiki-init`.

Các trang trích dẫn nguồn dạng `path` hoặc `path#symbol` (ví dụ `src/auth/session.ts#refreshToken`),
không dùng số dòng hay hash commit: số dòng đổi sau mỗi lần sửa code, còn hash biến mất sau squash
hoặc rebase merge. Symbol nào không còn tồn tại sẽ bị phát hiện.

## Chế độ cá nhân

```
<project>/.wiki/            repo git riêng, bị exclude khỏi repo project
├── SCHEMA.md               hợp đồng: loại trang, format, quy trình
├── index.md                danh mục mọi trang
├── log.md                  nhật ký: ## [YYYY-MM-DD] init|sync|ingest|query|lint | ...
├── .sync-state             commit của project mà wiki đã khớp
├── raw/                    tài liệu bạn bỏ vào: datasheet, ghi chú, dump (agent không sửa)
└── wiki/                   các trang do agent viết
```

`.wiki/` được thêm vào `.git/info/exclude`, chỉ có hiệu lực trên máy bạn, nên project không bị đổi
gì và đồng đội không thấy gì. `wiki-sync` chạy `git diff <.sync-state>..HEAD`, tìm các trang trích
dẫn file đã đổi, sửa chúng, rồi commit trong repo wiki. Commit của đồng đội đến qua `git pull`, sau
đó chạy `wiki-sync`.

- Tìm kiếm bằng `rg --no-ignore -n "từ khóa" .wiki/wiki` (công cụ tôn trọng ignore sẽ bỏ qua thư mục bị exclude).
- Backup: `git -C .wiki remote add origin <repo-private-của-bạn>`; đừng push lên repo của team.
- `git clean -fdx` bỏ qua `.wiki/` (repo lồng), nhưng `git clean -ffdx` sẽ xóa nó.

## Chế độ nhóm

Dành cho nhóm có người dùng agent, có người không, và leader là người merge PR.

```
<project>/
├── docs/wiki/
│   ├── SCHEMA.md            hợp đồng mà mọi agent làm theo
│   ├── README.md            luật chơi cho người đọc (gửi cái này cho cả nhóm)
│   ├── wiki.config.json     các loại trang và trạng thái hợp lệ
│   ├── index.md             do script SINH RA, không sửa tay
│   ├── .sync-state          commit của nhánh chính mà người giữ wiki đã sync tới
│   ├── overview.md
│   ├── modules/<đường dẫn code>.md, concepts/<slug>.md, decisions/<ngày>-<slug>.md
├── tools/wiki/wiki.mjs      script kiểm tra + sinh index (Node 18+, không cần thư viện, không dùng AI)
└── .github/workflows/wiki.yml
```

### Thiết lập (một lần, do leader làm)

Chạy `wiki-init` và nói là cho nhóm (hoặc `--shared`). Nó làm trên nhánh `wiki/init`, tạo các file
ở trên, hỏi trước rồi mới thêm một khối trỏ ngắn vào `CLAUDE.md` và `AGENTS.md` của team, viết các
trang đầu tiên, rồi đề nghị mở PR.

### Hằng ngày

1. **Thành viên có agent** làm xong việc thì agent chạy `wiki-update`: kiểm tra trang nào trích dẫn
   file đã đổi trong nhánh rồi sửa đúng các trang đó, trong cùng PR. Nó không đụng vào `index.md`.
   (Đồng đội không cài bộ skill này vẫn nhận được hướng dẫn tương tự từ `SCHEMA.md` qua khối trỏ.)
2. **Thành viên không dùng agent** không phải làm gì với wiki.
3. **GitHub Actions** chạy `tools/wiki/wiki.mjs check` trên mọi PR và để lại một bình luận (tự cập
   nhật mỗi lần push): trang lệch so với code, trang có thể bị trùng, link hỏng, header trang sai,
   thứ trông giống secret. **Cảnh báo không bao giờ làm check thất bại**; lỗi thì làm check đỏ nhưng
   chỉ chặn merge khi chủ repo đặt check này là bắt buộc.
4. **Leader merge** PR như bình thường (squash hay merge commit đều được). Gặp conflict trong
   `docs/wiki/` thì lấy bên nào cũng được: wiki sinh ra từ code nên không mất gì.
5. **Leader chạy `wiki-sync`** sau vài PR hoặc cuối sprint: trên nhánh chính đã cập nhật, nó kiểm
   lại các trang tác giả đã sửa, vá phần lệch người khác bỏ sót, gộp trang trùng, sinh lại
   `index.md`, rồi mở PR `wiki: sync`. Không bao giờ push thẳng lên nhánh chính.

### Vì sao ít conflict và ít trùng lặp

- Không ai sửa tay `index.md`, và không có `log.md` (lịch sử git đã là nhật ký), nên hai file mà
  mọi thay đổi đều đụng tới đã bị loại bỏ.
- Chỉ người giữ wiki chạy sync, nên không có cảnh nhiều agent cùng viết lại một trang từ cùng một diff.
- Trang có **đường dẫn xác định được** (trang module ánh xạ theo thư mục code, slug khái niệm là
  thuật ngữ chuẩn, quyết định có ngày), nên hai người viết về cùng một thứ sẽ sửa cùng một file và
  git báo conflict, thay vì âm thầm có hai trang. Script còn cảnh báo các trang có tên hoặc alias
  giống hay gần giống nhau.
- Trang viết mỗi câu một dòng và agent chỉ sửa tối thiểu, nên git merge theo từng câu.

### Chi phí

Bước kiểm tra là script Node thường: miễn phí với repo public, và rất ít so với số phút GitHub
Actions miễn phí của repo private (mỗi lần chạy vài giây). Phần việc cần AI (`wiki-update`,
`wiki-sync`) chạy trong agent của từng người, không chạy trên CI.

### Nâng cấp công cụ của nhóm

Sau khi cập nhật repo này, làm mới script và workflow trong project bằng
`node <llm-wiki>/skills/wiki-init/scripts/bootstrap-shared.mjs --update-tools` (trang và schema không
bao giờ bị ghi đè).

## Cấu trúc repo

```
llm-wiki/
├── .claude-plugin/                       manifest plugin + marketplace cho Claude Code
├── .agents/plugins/marketplace.json      marketplace cho Codex
├── plugin.json                           manifest plugin cho Codex
├── hooks/                                hook SessionStart (khi cài bằng plugin)
├── install.ps1 / install.sh              cài bằng script (cách B)
├── global/wiki-hint.md                   khối chỉ dẫn toàn cục (cách B)
└── skills/
    ├── wiki-init/
    │   ├── SKILL.md
    │   ├── assets/                       template chế độ cá nhân
    │   │   └── shared/                   template chế độ nhóm, wiki.mjs, wiki.yml
    │   └── scripts/                      bootstrap.ps1 / bootstrap.sh (cá nhân), bootstrap-shared.mjs (nhóm)
    ├── wiki-sync/SKILL.md
    ├── wiki-update/SKILL.md
    └── wiki-lint/SKILL.md
```

## License

MIT
