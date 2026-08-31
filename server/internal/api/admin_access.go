package api

import (
	"fmt"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/xsnbb/server/internal/app"
	"github.com/xsnbb/server/internal/security"
)

var adminUsernamePattern = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9_]{2,31}$`)

var adminPermissionCatalog = []string{
	"verification.review",
	"profile.private.read",
	"post.moderate",
	"comment.moderate",
	"report.review",
	"appeal.review",
	"user.manage",
	"tool.manage",
	"ai_provider.manage",
	"kb.manage",
	"pending_question.answer",
	"settings.manage",
	"dm.read",
	"audit.security.read",
}

func (a *API) adminResponse(admin *app.AdminAccount) gin.H {
	return gin.H{
		"id":          admin.ID,
		"username":    admin.Username,
		"is_super":    admin.IsSuper,
		"role_ids":    admin.RoleIDs,
		"permissions": a.store.AdminPermissions(admin.Username),
		"enabled":     admin.Enabled,
		"created_at":  admin.CreatedAt,
		"updated_at":  admin.UpdatedAt,
	}
}

func permissionAllowed(permission string) bool {
	for _, allowed := range adminPermissionCatalog {
		if permission == allowed {
			return true
		}
	}
	return false
}

func normalizePermissions(items []string) ([]string, error) {
	seen := map[string]bool{}
	out := []string{}
	for _, item := range items {
		permission := strings.TrimSpace(item)
		if !permissionAllowed(permission) {
			return nil, fmt.Errorf("未知权限点：%s", permission)
		}
		if !seen[permission] {
			seen[permission] = true
			out = append(out, permission)
		}
	}
	sort.Strings(out)
	return out, nil
}

func (a *API) adminRoles(c *gin.Context) {
	items := []gin.H{}
	a.store.MuRLock(func() {
		roleIDs := make([]int64, 0, len(a.store.AdminRoles))
		for id := range a.store.AdminRoles {
			roleIDs = append(roleIDs, id)
		}
		sort.Slice(roleIDs, func(i, j int) bool { return roleIDs[i] < roleIDs[j] })
		for _, id := range roleIDs {
			role := a.store.AdminRoles[id]
			assigned := 0
			for _, admin := range a.store.Admins {
				if contains(admin.RoleIDs, id) {
					assigned++
				}
			}
			items = append(items, gin.H{"id": role.ID, "name": role.Name, "permissions": role.Permissions, "protected": role.Protected, "assigned_admins": assigned, "created_at": role.CreatedAt, "updated_at": role.UpdatedAt})
		}
	})
	c.JSON(http.StatusOK, gin.H{"items": items, "permission_catalog": adminPermissionCatalog})
}

func (a *API) createAdminRole(c *gin.Context) {
	var in struct {
		Name        string   `json:"name"`
		Permissions []string `json:"permissions"`
	}
	if c.ShouldBindJSON(&in) != nil || strings.TrimSpace(in.Name) == "" {
		fail(c, http.StatusUnprocessableEntity, "ROLE_INVALID", "请填写角色名称并选择权限")
		return
	}
	permissions, err := normalizePermissions(in.Permissions)
	if err != nil {
		fail(c, http.StatusUnprocessableEntity, "PERMISSION_INVALID", err.Error())
		return
	}
	name := strings.TrimSpace(in.Name)
	var created app.AdminRole
	err = a.store.WithLockErr(func() error {
		for _, role := range a.store.AdminRoles {
			if strings.EqualFold(role.Name, name) {
				return fmt.Errorf("角色名称已存在")
			}
		}
		now := time.Now()
		created = app.AdminRole{ID: a.store.NextID(), Name: name, Permissions: permissions, CreatedAt: now, UpdatedAt: now}
		a.store.AdminRoles[created.ID] = &created
		a.store.AddAuditUnlocked(c.MustGet("admin").(string), "role.create", fmt.Sprintf("role:%d", created.ID), "success", "", "security")
		return nil
	})
	if err != nil {
		fail(c, http.StatusConflict, "ROLE_NAME_TAKEN", err.Error())
		return
	}
	c.JSON(http.StatusCreated, gin.H{"role": created})
}

func (a *API) updateAdminRole(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	var in struct {
		Name        string   `json:"name"`
		Permissions []string `json:"permissions"`
	}
	if c.ShouldBindJSON(&in) != nil || strings.TrimSpace(in.Name) == "" {
		fail(c, http.StatusUnprocessableEntity, "ROLE_INVALID", "请填写角色名称")
		return
	}
	permissions, err := normalizePermissions(in.Permissions)
	if err != nil {
		fail(c, http.StatusUnprocessableEntity, "PERMISSION_INVALID", err.Error())
		return
	}
	name := strings.TrimSpace(in.Name)
	var updated app.AdminRole
	err = a.store.WithLockErr(func() error {
		role := a.store.AdminRoles[id]
		if role == nil {
			return fmt.Errorf("角色不存在")
		}
		if role.Protected {
			return fmt.Errorf("超级管理员角色不可修改")
		}
		for otherID, other := range a.store.AdminRoles {
			if otherID != id && strings.EqualFold(other.Name, name) {
				return fmt.Errorf("角色名称已存在")
			}
		}
		role.Name = name
		role.Permissions = permissions
		role.UpdatedAt = time.Now()
		updated = *role
		updated.Permissions = append([]string(nil), role.Permissions...)
		a.store.AddAuditUnlocked(c.MustGet("admin").(string), "role.update", fmt.Sprintf("role:%d", id), "success", "", "security")
		return nil
	})
	if err != nil {
		fail(c, http.StatusConflict, "ROLE_UPDATE_FAILED", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"role": updated})
}

func (a *API) deleteAdminRole(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	err := a.store.WithLockErr(func() error {
		role := a.store.AdminRoles[id]
		if role == nil {
			return fmt.Errorf("角色不存在")
		}
		if role.Protected {
			return fmt.Errorf("超级管理员角色不可删除")
		}
		for _, admin := range a.store.Admins {
			if contains(admin.RoleIDs, id) {
				return fmt.Errorf("仍有管理员使用该角色，请先调整管理员授权")
			}
		}
		delete(a.store.AdminRoles, id)
		a.store.AddAuditUnlocked(c.MustGet("admin").(string), "role.delete", fmt.Sprintf("role:%d", id), "success", "", "security")
		return nil
	})
	if err != nil {
		fail(c, http.StatusConflict, "ROLE_DELETE_FAILED", err.Error())
		return
	}
	c.Status(http.StatusNoContent)
}

func (a *API) adminAccounts(c *gin.Context) {
	items := []gin.H{}
	a.store.MuRLock(func() {
		usernames := make([]string, 0, len(a.store.Admins))
		for username := range a.store.Admins {
			usernames = append(usernames, username)
		}
		sort.Strings(usernames)
		for _, username := range usernames {
			admin := a.store.Admins[username]
			roleNames := []string{}
			for _, roleID := range admin.RoleIDs {
				if role := a.store.AdminRoles[roleID]; role != nil {
					roleNames = append(roleNames, role.Name)
				}
			}
			items = append(items, gin.H{"id": admin.ID, "username": admin.Username, "is_super": admin.IsSuper, "role_ids": admin.RoleIDs, "role_names": roleNames, "permissions": a.store.AdminPermissionsUnlocked(username), "enabled": admin.Enabled, "created_at": admin.CreatedAt, "updated_at": admin.UpdatedAt})
		}
	})
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func validateAssignableRoles(store *app.Store, roleIDs []int64) ([]int64, error) {
	seen := map[int64]bool{}
	out := []int64{}
	for _, roleID := range roleIDs {
		role := store.AdminRoles[roleID]
		if role == nil {
			return nil, fmt.Errorf("角色 %s 不存在", strconv.FormatInt(roleID, 10))
		}
		if role.Protected || containsString(role.Permissions, "*") {
			return nil, fmt.Errorf("不能授予超级管理员角色")
		}
		if !seen[roleID] {
			seen[roleID] = true
			out = append(out, roleID)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i] < out[j] })
	return out, nil
}

func (a *API) createAdminAccount(c *gin.Context) {
	var in struct {
		Username string  `json:"username"`
		Password string  `json:"password"`
		RoleIDs  []int64 `json:"role_ids"`
	}
	if c.ShouldBindJSON(&in) != nil || !adminUsernamePattern.MatchString(in.Username) || len(in.Password) < 8 {
		fail(c, http.StatusUnprocessableEntity, "ADMIN_INVALID", "登录名需以字母开头且为 3–32 位字母、数字或下划线；密码至少 8 位")
		return
	}
	hash, err := security.HashPassword(in.Password)
	if err != nil {
		fail(c, http.StatusUnprocessableEntity, "PASSWORD_INVALID", "密码至少需要 8 位")
		return
	}
	var created app.AdminAccount
	err = a.store.WithLockErr(func() error {
		if _, exists := a.store.Admins[in.Username]; exists {
			return fmt.Errorf("登录名已被使用")
		}
		roleIDs, roleErr := validateAssignableRoles(a.store, in.RoleIDs)
		if roleErr != nil {
			return roleErr
		}
		now := time.Now()
		created = app.AdminAccount{ID: a.store.NextID(), Username: in.Username, PasswordHash: hash, RoleIDs: roleIDs, Enabled: true, CreatedAt: now, UpdatedAt: now}
		a.store.Admins[created.Username] = &created
		a.store.AddAuditUnlocked(c.MustGet("admin").(string), "admin.create", "admin:"+created.Username, "success", "", "security")
		return nil
	})
	if err != nil {
		fail(c, http.StatusConflict, "ADMIN_CREATE_FAILED", err.Error())
		return
	}
	c.JSON(http.StatusCreated, gin.H{"admin": a.adminResponse(&created)})
}

func (a *API) updateAdminAccount(c *gin.Context) {
	username := c.Param("username")
	var in struct {
		RoleIDs []int64 `json:"role_ids"`
		Enabled *bool   `json:"enabled"`
	}
	if c.ShouldBindJSON(&in) != nil {
		fail(c, http.StatusBadRequest, "ADMIN_INVALID", "管理员配置格式无效")
		return
	}
	var updated app.AdminAccount
	err := a.store.WithLockErr(func() error {
		admin := a.store.Admins[username]
		if admin == nil {
			return fmt.Errorf("管理员不存在")
		}
		if admin.IsSuper {
			return fmt.Errorf("不能修改超级管理员的角色或状态")
		}
		roleIDs, roleErr := validateAssignableRoles(a.store, in.RoleIDs)
		if roleErr != nil {
			return roleErr
		}
		admin.RoleIDs = roleIDs
		if in.Enabled != nil {
			admin.Enabled = *in.Enabled
			if !admin.Enabled {
				a.store.InvalidateAdminSessionsUnlocked(username)
			}
		}
		admin.UpdatedAt = time.Now()
		updated = *admin
		updated.RoleIDs = append([]int64(nil), admin.RoleIDs...)
		a.store.AddAuditUnlocked(c.MustGet("admin").(string), "admin.update", "admin:"+username, "success", "", "security")
		return nil
	})
	if err != nil {
		fail(c, http.StatusConflict, "ADMIN_UPDATE_FAILED", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"admin": a.adminResponse(&updated)})
}

func (a *API) resetAdminPassword(c *gin.Context) {
	username := c.Param("username")
	var in struct {
		Password string `json:"password"`
	}
	if c.ShouldBindJSON(&in) != nil || len(in.Password) < 8 {
		fail(c, http.StatusUnprocessableEntity, "PASSWORD_INVALID", "新密码至少需要 8 位")
		return
	}
	hash, err := security.HashPassword(in.Password)
	if err != nil {
		fail(c, http.StatusUnprocessableEntity, "PASSWORD_INVALID", "新密码至少需要 8 位")
		return
	}
	err = a.store.WithLockErr(func() error {
		admin := a.store.Admins[username]
		if admin == nil {
			return fmt.Errorf("管理员不存在")
		}
		if admin.IsSuper {
			return fmt.Errorf("超级管理员密码请通过独立安全流程修改")
		}
		admin.PasswordHash = hash
		admin.UpdatedAt = time.Now()
		a.store.InvalidateAdminSessionsUnlocked(username)
		a.store.AddAuditUnlocked(c.MustGet("admin").(string), "admin.password.reset", "admin:"+username, "success", "", "security")
		return nil
	})
	if err != nil {
		fail(c, http.StatusConflict, "ADMIN_PASSWORD_RESET_FAILED", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"reset": true})
}

func containsString(items []string, target string) bool {
	for _, item := range items {
		if item == target {
			return true
		}
	}
	return false
}
